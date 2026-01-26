"""Tests for file helper functionality in composio/core/models/_files.py.

These tests ensure that the FileHelper class correctly handles JSON schemas
that use anyOf, oneOf, allOf, or $ref instead of direct 'type' properties.
"""

from unittest.mock import Mock, patch, MagicMock

import pytest

from composio.client.types import Tool, tool_list_response
from composio.core.models._files import (
    FileHelper,
    FileUploadable,
    _is_url,
    _get_extension_from_mimetype,
    _generate_timestamped_filename,
    _fetch_file_from_url,
    _upload_bytes_to_s3,
)
from composio.core.models.base import allow_tracking
from composio.exceptions import ErrorUploadingFile


@pytest.fixture(autouse=True)
def disable_telemetry():
    """Disable telemetry for all tests to prevent thread issues."""
    token = allow_tracking.set(False)
    yield
    allow_tracking.reset(token)


@pytest.fixture
def mock_client():
    """Create a mock HTTP client."""
    return Mock()


@pytest.fixture
def file_helper(mock_client):
    """Create a FileHelper instance with a mock client."""
    return FileHelper(client=mock_client)


@pytest.fixture
def mock_tool():
    """Create a mock tool for testing."""
    return Tool(
        name="Test Tool",
        slug="TEST_TOOL",
        description="Test tool",
        input_parameters={
            "properties": {
                "query": {"type": "string"},
            },
            "type": "object",
        },
        output_parameters={
            "properties": {
                "data": {"type": "object", "properties": {}},
            },
            "type": "object",
        },
        available_versions=["v1.0.0"],
        version="v1.0.0",
        scopes=[],
        status="active",
        toolkit=tool_list_response.ItemToolkit(
            name="Test Toolkit", slug="test_toolkit", logo=""
        ),
        deprecated=tool_list_response.ItemDeprecated(
            available_versions=["v1.0.0"],
            displayName="Test Tool",
            version="v1.0.0",
            toolkit=tool_list_response.ItemDeprecatedToolkit(logo=""),
            is_deprecated=False,
        ),
        is_deprecated=False,
        no_auth=False,
        tags=[],
    )


class TestFileHelperSchemaHandling:
    """Test cases for handling schemas without direct 'type' property.

    Regression tests for PLEN-766: KeyError: 'type' when schemas use
    anyOf, oneOf, allOf, or $ref instead of direct type properties.
    """

    def test_substitute_file_uploads_with_oneof_schema(self, file_helper, mock_tool):
        """Test that oneOf schemas don't cause KeyError in upload path."""
        schema_with_oneof = {
            "properties": {
                "input": {
                    "oneOf": [
                        {"type": "string"},
                        {"type": "object", "properties": {"file": {"type": "string"}}},
                    ]
                }
            }
        }
        request = {"input": {"file": "test.txt"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_with_oneof,
            request=request.copy(),
        )
        assert result == {"input": {"file": "test.txt"}}

    def test_substitute_file_uploads_with_anyof_schema(self, file_helper, mock_tool):
        """Test that anyOf schemas don't cause KeyError in upload path."""
        schema_with_anyof = {
            "properties": {
                "data": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "object", "properties": {"value": {"type": "string"}}},
                    ]
                }
            }
        }
        request = {"data": {"value": "test"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_with_anyof,
            request=request.copy(),
        )
        assert result == {"data": {"value": "test"}}

    def test_substitute_file_uploads_with_allof_schema(self, file_helper, mock_tool):
        """Test that allOf schemas don't cause KeyError in upload path."""
        schema_with_allof = {
            "properties": {
                "config": {
                    "allOf": [
                        {"properties": {"name": {"type": "string"}}},
                        {"properties": {"value": {"type": "string"}}},
                    ]
                }
            }
        }
        request = {"config": {"name": "test", "value": "123"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_with_allof,
            request=request.copy(),
        )
        assert result == {"config": {"name": "test", "value": "123"}}

    def test_substitute_file_uploads_with_ref_schema(self, file_helper, mock_tool):
        """Test that $ref schemas don't cause KeyError in upload path."""
        schema_with_ref = {
            "properties": {"reference": {"$ref": "#/definitions/SomeType"}}
        }
        request = {"reference": {"nested": "value"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_with_ref,
            request=request.copy(),
        )
        assert result == {"reference": {"nested": "value"}}

    def test_substitute_file_downloads_with_oneof_schema(self, file_helper, mock_tool):
        """Test that oneOf schemas don't cause KeyError in download path."""
        schema_with_oneof = {
            "properties": {
                "result": {
                    "oneOf": [
                        {"type": "string"},
                        {"type": "object", "properties": {"data": {"type": "string"}}},
                    ]
                }
            }
        }
        response = {"result": {"data": "some value"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=schema_with_oneof,
            request=response.copy(),
        )
        assert result == {"result": {"data": "some value"}}

    def test_substitute_file_downloads_with_anyof_schema(self, file_helper, mock_tool):
        """Test that anyOf schemas don't cause KeyError in download path."""
        schema_with_anyof = {
            "properties": {
                "output": {
                    "anyOf": [
                        {"type": "string"},
                        {
                            "type": "object",
                            "properties": {"nested": {"type": "string"}},
                        },
                    ]
                }
            }
        }
        response = {"output": {"nested": "value"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=schema_with_anyof,
            request=response.copy(),
        )
        assert result == {"output": {"nested": "value"}}

    def test_substitute_file_downloads_with_allof_schema(self, file_helper, mock_tool):
        """Test that allOf schemas don't cause KeyError in download path."""
        schema_with_allof = {
            "properties": {
                "response": {
                    "allOf": [
                        {"properties": {"status": {"type": "string"}}},
                        {"properties": {"message": {"type": "string"}}},
                    ]
                }
            }
        }
        response = {"response": {"status": "ok", "message": "success"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=schema_with_allof,
            request=response.copy(),
        )
        assert result == {"response": {"status": "ok", "message": "success"}}

    def test_substitute_file_downloads_with_ref_schema(self, file_helper, mock_tool):
        """Test that $ref schemas don't cause KeyError in download path."""
        schema_with_ref = {
            "properties": {"data": {"$ref": "#/definitions/ResponseType"}}
        }
        response = {"data": {"field": "value"}}

        # Should not raise KeyError
        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=schema_with_ref,
            request=response.copy(),
        )
        assert result == {"data": {"field": "value"}}

    def test_substitute_file_uploads_with_normal_type_still_works(
        self, file_helper, mock_tool
    ):
        """Test that normal schemas with 'type' property still work correctly."""
        schema_with_type = {
            "properties": {
                "nested": {
                    "type": "object",
                    "properties": {
                        "value": {"type": "string"},
                    },
                }
            }
        }
        request = {"nested": {"value": "test"}}

        # Should process normally and recurse into nested object
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_with_type,
            request=request.copy(),
        )
        assert result == {"nested": {"value": "test"}}

    def test_substitute_file_downloads_with_normal_type_still_works(
        self, file_helper, mock_tool
    ):
        """Test that normal schemas with 'type' property still work correctly."""
        schema_with_type = {
            "properties": {
                "data": {
                    "type": "object",
                    "properties": {
                        "result": {"type": "string"},
                    },
                }
            }
        }
        response = {"data": {"result": "success"}}

        # Should process normally and recurse into nested object
        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=schema_with_type,
            request=response.copy(),
        )
        assert result == {"data": {"result": "success"}}

    def test_substitute_with_empty_properties(self, file_helper, mock_tool):
        """Test handling of schemas with empty properties."""
        schema_empty = {"properties": {}}
        request = {"unknown": {"nested": "value"}}

        # Should not raise any errors
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_empty,
            request=request.copy(),
        )
        assert result == {"unknown": {"nested": "value"}}

    def test_substitute_with_no_properties_key(self, file_helper, mock_tool):
        """Test handling of schemas without properties key."""
        schema_no_props = {"type": "object"}
        request = {"data": {"value": "test"}}

        # Should return request unchanged
        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=schema_no_props,
            request=request.copy(),
        )
        assert result == {"data": {"value": "test"}}


class TestFileUploadableInUnionTypes:
    """Test cases for file_uploadable detection in anyOf, oneOf, and allOf schemas."""

    def test_has_file_property_direct(self, file_helper):
        """Test _has_file_property detects direct file_uploadable."""
        schema = {"type": "string", "file_uploadable": True}
        assert file_helper._has_file_property(schema, "file_uploadable") is True

    def test_has_file_property_in_anyof(self, file_helper):
        """Test _has_file_property detects file_uploadable in anyOf."""
        schema = {
            "anyOf": [
                {"type": "string", "file_uploadable": True},
                {"type": "null"},
            ]
        }
        assert file_helper._has_file_property(schema, "file_uploadable") is True

    def test_has_file_property_in_oneof(self, file_helper):
        """Test _has_file_property detects file_uploadable in oneOf."""
        schema = {
            "oneOf": [
                {"type": "string", "file_uploadable": True},
                {"type": "string", "description": "URL"},
            ]
        }
        assert file_helper._has_file_property(schema, "file_uploadable") is True

    def test_has_file_property_in_allof(self, file_helper):
        """Test _has_file_property detects file_uploadable in allOf."""
        schema = {
            "allOf": [
                {"type": "string", "file_uploadable": True},
                {"minLength": 1},
            ]
        }
        assert file_helper._has_file_property(schema, "file_uploadable") is True

    def test_has_file_property_nested_in_anyof(self, file_helper):
        """Test _has_file_property detects file_uploadable nested in anyOf object."""
        schema = {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "attachment": {"type": "string", "file_uploadable": True}
                    },
                },
                {"type": "string"},
            ]
        }
        assert file_helper._has_file_property(schema, "file_uploadable") is True

    def test_has_file_property_not_present(self, file_helper):
        """Test _has_file_property returns False when not present."""
        schema = {
            "anyOf": [
                {"type": "string"},
                {"type": "null"},
            ]
        }
        assert file_helper._has_file_property(schema, "file_uploadable") is False

    def test_has_file_downloadable_in_anyof(self, file_helper):
        """Test _has_file_property detects file_downloadable in anyOf."""
        schema = {
            "anyOf": [
                {"type": "object", "file_downloadable": True},
                {"type": "null"},
            ]
        }
        assert file_helper._has_file_property(schema, "file_downloadable") is True

    def test_transform_schema_direct_file_uploadable(self, file_helper):
        """Test _transform_schema_for_file_upload transforms direct file_uploadable."""
        schema = {
            "type": "string",
            "file_uploadable": True,
            "description": "Upload a file",
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["format"] == "path"
        assert result["type"] == "string"
        assert result["file_uploadable"] is True

    def test_transform_schema_file_uploadable_in_anyof(self, file_helper):
        """Test _transform_schema_for_file_upload transforms file_uploadable in anyOf."""
        schema = {
            "anyOf": [
                {"type": "string", "file_uploadable": True, "description": "File path"},
                {"type": "null"},
            ]
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["anyOf"][0]["format"] == "path"
        assert result["anyOf"][0]["file_uploadable"] is True
        assert "format" not in result["anyOf"][1]

    def test_transform_schema_file_uploadable_in_oneof(self, file_helper):
        """Test _transform_schema_for_file_upload transforms file_uploadable in oneOf."""
        schema = {
            "oneOf": [
                {"type": "string", "file_uploadable": True},
                {"type": "string", "description": "URL reference"},
            ]
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["oneOf"][0]["format"] == "path"
        assert result["oneOf"][0]["file_uploadable"] is True
        assert "format" not in result["oneOf"][1]

    def test_transform_schema_file_uploadable_in_allof(self, file_helper):
        """Test _transform_schema_for_file_upload transforms file_uploadable in allOf."""
        schema = {
            "allOf": [
                {"type": "string", "file_uploadable": True},
                {"minLength": 1},
            ]
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["allOf"][0]["format"] == "path"
        assert result["allOf"][0]["file_uploadable"] is True

    def test_transform_schema_nested_file_uploadable_in_anyof(self, file_helper):
        """Test transform handles nested file_uploadable inside anyOf objects."""
        schema = {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "attachment": {"type": "string", "file_uploadable": True}
                    },
                },
                {"type": "string"},
            ]
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["anyOf"][0]["properties"]["attachment"]["format"] == "path"
        assert result["anyOf"][0]["properties"]["attachment"]["file_uploadable"] is True

    def test_transform_schema_array_items_with_anyof(self, file_helper):
        """Test transform handles array items with anyOf containing file_uploadable."""
        schema = {
            "type": "array",
            "items": {
                "anyOf": [
                    {"type": "string", "file_uploadable": True},
                    {"type": "null"},
                ]
            },
        }
        result = file_helper._transform_schema_for_file_upload(schema)
        assert result["items"]["anyOf"][0]["format"] == "path"
        assert result["items"]["anyOf"][0]["file_uploadable"] is True

    def test_process_file_uploadable_schema_with_anyof(self, file_helper):
        """Test process_file_uploadable_schema handles anyOf properties."""
        schema = {
            "type": "object",
            "properties": {
                "fileInput": {
                    "anyOf": [
                        {"type": "string", "file_uploadable": True},
                        {"type": "null"},
                    ]
                },
                "text": {"type": "string"},
            },
        }
        result = file_helper.process_file_uploadable_schema(schema)
        assert result["properties"]["fileInput"]["anyOf"][0]["format"] == "path"
        assert "format" not in result["properties"]["text"]


class TestFileUploadSubstitutionWithUnionTypes:
    """Test cases for file upload substitution with anyOf, oneOf, and allOf schemas."""

    def test_substitute_upload_with_file_uploadable_in_anyof(
        self, file_helper, mock_tool, mock_client
    ):
        """Test that file_uploadable in anyOf triggers file upload."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "fileInput": {
                    "anyOf": [
                        {"type": "string", "file_uploadable": True},
                        {"type": "null"},
                    ]
                }
            },
        }

        # Mock the file upload
        mock_client.post.return_value = Mock(
            key="s3key/file.txt", new_presigned_url="https://s3.example.com/upload"
        )

        with (
            pytest.raises(Exception),
        ):  # Will fail because file doesn't exist, but proves detection works
            file_helper._substitute_file_uploads_recursively(
                tool=mock_tool,
                schema=mock_tool.input_parameters,
                request={"fileInput": "/path/to/file.txt"},
            )

    def test_substitute_upload_null_value_in_anyof(self, file_helper, mock_tool):
        """Test that null values in anyOf with file_uploadable are handled."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "fileInput": {
                    "anyOf": [
                        {"type": "string", "file_uploadable": True},
                        {"type": "null"},
                    ]
                }
            },
        }

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={"fileInput": None},
        )
        # None/empty values should be removed
        assert "fileInput" not in result

    def test_substitute_upload_empty_string_in_anyof(self, file_helper, mock_tool):
        """Test that empty string values in anyOf with file_uploadable are handled."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "fileInput": {
                    "anyOf": [
                        {"type": "string", "file_uploadable": True},
                        {"type": "null"},
                    ]
                }
            },
        }

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={"fileInput": ""},
        )
        # Empty values should be removed
        assert "fileInput" not in result

    def test_substitute_upload_nested_in_anyof_object(self, file_helper, mock_tool):
        """Test file upload for nested file_uploadable inside anyOf object."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "content": {
                    "anyOf": [
                        {
                            "type": "object",
                            "properties": {
                                "attachment": {
                                    "type": "string",
                                    "file_uploadable": True,
                                }
                            },
                        },
                        {"type": "string"},
                    ]
                }
            },
        }

        # Should try to process the nested file_uploadable
        with pytest.raises(Exception):  # Will fail because file doesn't exist
            file_helper._substitute_file_uploads_recursively(
                tool=mock_tool,
                schema=mock_tool.input_parameters,
                request={"content": {"attachment": "/path/to/file.pdf"}},
            )


class TestFileDownloadSubstitutionWithUnionTypes:
    """Test cases for file download substitution with anyOf, oneOf, and allOf schemas."""

    def test_substitute_download_with_file_downloadable_in_anyof(
        self, file_helper, mock_tool
    ):
        """Test that file_downloadable in anyOf triggers file download detection."""
        mock_tool.output_parameters = {
            "type": "object",
            "properties": {
                "fileOutput": {
                    "anyOf": [
                        {
                            "type": "object",
                            "file_downloadable": True,
                            "properties": {
                                "s3url": {"type": "string"},
                                "mimetype": {"type": "string"},
                                "name": {"type": "string"},
                            },
                        },
                        {"type": "null"},
                    ]
                }
            },
        }

        # Should try to download the file (will fail but proves detection)
        with pytest.raises(Exception):
            file_helper._substitute_file_downloads_recursively(
                tool=mock_tool,
                schema=mock_tool.output_parameters,
                request={
                    "fileOutput": {
                        "s3url": "https://s3.example.com/file.txt",
                        "mimetype": "text/plain",
                        "name": "file.txt",
                    }
                },
            )

    def test_substitute_download_null_value_in_anyof(self, file_helper, mock_tool):
        """Test that null values in anyOf with file_downloadable are handled."""
        mock_tool.output_parameters = {
            "type": "object",
            "properties": {
                "fileOutput": {
                    "anyOf": [
                        {"type": "object", "file_downloadable": True},
                        {"type": "null"},
                    ]
                }
            },
        }

        result = file_helper._substitute_file_downloads_recursively(
            tool=mock_tool,
            schema=mock_tool.output_parameters,
            request={"fileOutput": None},
        )
        assert result["fileOutput"] is None

    def test_substitute_download_nested_in_anyof_object(self, file_helper, mock_tool):
        """Test file download for nested file_downloadable inside anyOf object."""
        mock_tool.output_parameters = {
            "type": "object",
            "properties": {
                "response": {
                    "anyOf": [
                        {
                            "type": "object",
                            "properties": {
                                "attachment": {
                                    "type": "object",
                                    "file_downloadable": True,
                                    "properties": {
                                        "s3url": {"type": "string"},
                                        "mimetype": {"type": "string"},
                                        "name": {"type": "string"},
                                    },
                                }
                            },
                        },
                        {"type": "string"},
                    ]
                }
            },
        }

        # Should try to download the nested file
        with pytest.raises(Exception):
            file_helper._substitute_file_downloads_recursively(
                tool=mock_tool,
                schema=mock_tool.output_parameters,
                request={
                    "response": {
                        "attachment": {
                            "s3url": "https://s3.example.com/doc.pdf",
                            "mimetype": "application/pdf",
                            "name": "document.pdf",
                        }
                    }
                },
            )

    def test_substitute_download_with_file_downloadable_in_oneof(
        self, file_helper, mock_tool
    ):
        """Test that file_downloadable in oneOf triggers file download detection."""
        mock_tool.output_parameters = {
            "type": "object",
            "properties": {
                "result": {
                    "oneOf": [
                        {
                            "type": "object",
                            "file_downloadable": True,
                            "properties": {
                                "s3url": {"type": "string"},
                                "mimetype": {"type": "string"},
                                "name": {"type": "string"},
                            },
                        },
                        {"type": "string"},
                    ]
                }
            },
        }

        with pytest.raises(Exception):
            file_helper._substitute_file_downloads_recursively(
                tool=mock_tool,
                schema=mock_tool.output_parameters,
                request={
                    "result": {
                        "s3url": "https://s3.example.com/file.txt",
                        "mimetype": "text/plain",
                        "name": "file.txt",
                    }
                },
            )

    def test_substitute_download_with_file_downloadable_in_allof(
        self, file_helper, mock_tool
    ):
        """Test that file_downloadable in allOf triggers file download detection."""
        mock_tool.output_parameters = {
            "type": "object",
            "properties": {
                "image": {
                    "allOf": [
                        {
                            "type": "object",
                            "file_downloadable": True,
                            "properties": {
                                "s3url": {"type": "string"},
                                "mimetype": {"type": "string"},
                                "name": {"type": "string"},
                            },
                        },
                        {"required": ["s3url"]},
                    ]
                }
            },
        }

        with pytest.raises(Exception):
            file_helper._substitute_file_downloads_recursively(
                tool=mock_tool,
                schema=mock_tool.output_parameters,
                request={
                    "image": {
                        "s3url": "https://s3.example.com/image.png",
                        "mimetype": "image/png",
                        "name": "image.png",
                    }
                },
            )


class TestFileHelperFindVariantMethods:
    """Test cases for _find_uploadable_schema_variant and _find_downloadable_schema_variant."""

    def test_find_uploadable_variant_in_anyof(self, file_helper):
        """Test finding uploadable variant in anyOf."""
        schema = {
            "anyOf": [
                {"type": "string", "file_uploadable": True},
                {"type": "null"},
            ]
        }
        result = file_helper._find_uploadable_schema_variant(schema)
        assert result is not None
        assert result.get("file_uploadable") is True

    def test_find_uploadable_variant_in_oneof(self, file_helper):
        """Test finding uploadable variant in oneOf."""
        schema = {
            "oneOf": [
                {"type": "string"},
                {"type": "string", "file_uploadable": True},
            ]
        }
        result = file_helper._find_uploadable_schema_variant(schema)
        assert result is not None
        assert result.get("file_uploadable") is True

    def test_find_uploadable_variant_in_allof(self, file_helper):
        """Test finding uploadable variant in allOf."""
        schema = {
            "allOf": [
                {"type": "string", "file_uploadable": True},
                {"minLength": 1},
            ]
        }
        result = file_helper._find_uploadable_schema_variant(schema)
        assert result is not None
        assert result.get("file_uploadable") is True

    def test_find_uploadable_variant_not_found(self, file_helper):
        """Test that None is returned when no uploadable variant exists."""
        schema = {
            "anyOf": [
                {"type": "string"},
                {"type": "null"},
            ]
        }
        result = file_helper._find_uploadable_schema_variant(schema)
        assert result is None

    def test_find_downloadable_variant_in_anyof(self, file_helper):
        """Test finding downloadable variant in anyOf."""
        schema = {
            "anyOf": [
                {"type": "object", "file_downloadable": True},
                {"type": "null"},
            ]
        }
        result = file_helper._find_downloadable_schema_variant(schema)
        assert result is not None
        assert result.get("file_downloadable") is True

    def test_find_downloadable_variant_in_oneof(self, file_helper):
        """Test finding downloadable variant in oneOf."""
        schema = {
            "oneOf": [
                {"type": "string"},
                {"type": "object", "file_downloadable": True},
            ]
        }
        result = file_helper._find_downloadable_schema_variant(schema)
        assert result is not None
        assert result.get("file_downloadable") is True

    def test_find_downloadable_variant_nested(self, file_helper):
        """Test finding downloadable variant with nested file_downloadable."""
        schema = {
            "anyOf": [
                {
                    "type": "object",
                    "properties": {
                        "file": {"type": "object", "file_downloadable": True}
                    },
                },
                {"type": "null"},
            ]
        }
        result = file_helper._find_downloadable_schema_variant(schema)
        assert result is not None
        assert result.get("type") == "object"


class TestFileUploadWithMixedSchemas:
    """Test cases for schemas with anyOf/oneOf/allOf alongside properties with file_uploadable."""

    def test_upload_from_base_properties_when_anyof_has_no_file_uploadable(
        self, file_helper, mock_tool
    ):
        """Test that file_uploadable in base properties works when sibling has anyOf without file_uploadable."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "metadata": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "null"},
                    ]
                },
                "file": {
                    "type": "string",
                    "file_uploadable": True,
                },
            },
        }

        # Should try to upload the file (will fail because file doesn't exist)
        with pytest.raises(Exception):
            file_helper._substitute_file_uploads_recursively(
                tool=mock_tool,
                schema=mock_tool.input_parameters,
                request={"metadata": "some data", "file": "/path/to/file.txt"},
            )

    def test_upload_when_root_has_anyof_without_file_uploadable_and_properties_with_file_uploadable(
        self, file_helper, mock_tool
    ):
        """Test upload when root schema has anyOf (no file_uploadable) and properties (with file_uploadable)."""
        mock_tool.input_parameters = {
            "type": "object",
            "anyOf": [
                {"required": ["text"]},
                {"required": ["file"]},
            ],
            "properties": {
                "text": {"type": "string"},
                "file": {"type": "string", "file_uploadable": True},
            },
        }

        # Should try to upload the file
        with pytest.raises(Exception):
            file_helper._substitute_file_uploads_recursively(
                tool=mock_tool,
                schema=mock_tool.input_parameters,
                request={"file": "/path/to/document.pdf"},
            )

    def test_metadata_preserved_when_file_upload_with_mixed_schema(
        self, file_helper, mock_tool
    ):
        """Test that non-file properties are preserved when processing mixed schemas."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "metadata": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "null"},
                    ]
                },
                "count": {"type": "integer"},
            },
        }

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={"metadata": "test data", "count": 42},
        )

        # Both values should be preserved unchanged
        assert result["metadata"] == "test data"
        assert result["count"] == 42


class TestUrlHelperFunctions:
    """Test cases for URL-related helper functions."""

    def test_is_url_with_http(self):
        """Test _is_url correctly identifies HTTP URLs."""
        assert _is_url("http://example.com/file.jpg") is True
        assert _is_url("http://localhost:8080/api/file") is True

    def test_is_url_with_https(self):
        """Test _is_url correctly identifies HTTPS URLs."""
        assert _is_url("https://example.com/file.jpg") is True
        assert _is_url("https://images.pexels.com/photos/123.jpg") is True

    def test_is_url_with_local_paths(self):
        """Test _is_url correctly rejects local file paths."""
        assert _is_url("/path/to/file.jpg") is False
        assert _is_url("./relative/path.txt") is False
        assert _is_url("file.txt") is False
        assert _is_url("C:\\Windows\\file.txt") is False

    def test_is_url_with_other_schemes(self):
        """Test _is_url rejects non-HTTP schemes."""
        assert _is_url("ftp://ftp.example.com/file.txt") is False
        assert _is_url("file:///local/file.txt") is False
        assert _is_url("mailto:test@example.com") is False

    def test_is_url_with_invalid_inputs(self):
        """Test _is_url handles invalid inputs gracefully."""
        assert _is_url("") is False
        assert _is_url("not a url") is False
        assert _is_url("http://") is False

    def test_get_extension_from_mimetype_common_types(self):
        """Test _get_extension_from_mimetype for common types."""
        assert _get_extension_from_mimetype("image/jpeg") == ".jpg"
        assert _get_extension_from_mimetype("image/png") == ".png"
        assert _get_extension_from_mimetype("application/pdf") == ".pdf"
        assert _get_extension_from_mimetype("text/plain") == ".txt"
        assert _get_extension_from_mimetype("application/json") == ".json"

    def test_get_extension_from_mimetype_unknown_type(self):
        """Test _get_extension_from_mimetype returns empty for unknown types."""
        assert _get_extension_from_mimetype("application/unknown") == ""
        assert _get_extension_from_mimetype("custom/type") == ""

    def test_generate_timestamped_filename(self):
        """Test _generate_timestamped_filename generates valid filenames."""
        filename = _generate_timestamped_filename(".jpg")
        assert filename.startswith("file_")
        assert filename.endswith(".jpg")
        assert len(filename) > 15  # Should have timestamp and unique ID

    def test_generate_timestamped_filename_no_extension(self):
        """Test _generate_timestamped_filename works without extension."""
        filename = _generate_timestamped_filename("")
        assert filename.startswith("file_")
        assert not filename.endswith(".")


class TestFetchFileFromUrl:
    """Test cases for _fetch_file_from_url function."""

    @patch("composio.core.models._files.requests.get")
    def test_fetch_file_from_url_success(self, mock_get):
        """Test successful file fetch from URL."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.content = b"test file content"
        mock_response.headers = {"content-type": "image/jpeg"}
        mock_get.return_value = mock_response

        filename, content, mimetype = _fetch_file_from_url(
            "https://example.com/image.jpg"
        )

        assert content == b"test file content"
        assert mimetype == "image/jpeg"
        assert filename == "image.jpg"
        mock_get.assert_called_once_with("https://example.com/image.jpg", timeout=30)

    @patch("composio.core.models._files.requests.get")
    def test_fetch_file_from_url_with_charset_in_content_type(self, mock_get):
        """Test that charset is stripped from content-type."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.content = b"<html></html>"
        mock_response.headers = {"content-type": "text/html; charset=utf-8"}
        mock_get.return_value = mock_response

        filename, content, mimetype = _fetch_file_from_url(
            "https://example.com/page.html"
        )

        assert mimetype == "text/html"

    @patch("composio.core.models._files.requests.get")
    def test_fetch_file_from_url_generates_filename_when_missing(self, mock_get):
        """Test filename generation when URL has no filename."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.content = b"image data"
        mock_response.headers = {"content-type": "image/png"}
        mock_get.return_value = mock_response

        filename, content, mimetype = _fetch_file_from_url("https://example.com/")

        assert filename.startswith("file_")
        assert filename.endswith(".png")

    @patch("composio.core.models._files.requests.get")
    def test_fetch_file_from_url_appends_extension_when_missing(self, mock_get):
        """Test extension is appended to original filename when missing."""
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.content = b"pdf data"
        mock_response.headers = {"content-type": "application/pdf"}
        mock_get.return_value = mock_response

        filename, content, mimetype = _fetch_file_from_url(
            "https://example.com/document"
        )

        # Should preserve original filename and append extension
        assert filename == "document.pdf"

    @patch("composio.core.models._files.requests.get")
    def test_fetch_file_from_url_failure(self, mock_get):
        """Test error handling when URL fetch fails."""
        mock_response = MagicMock()
        mock_response.ok = False
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        with pytest.raises(ErrorUploadingFile) as exc_info:
            _fetch_file_from_url("https://example.com/notfound.jpg")

        assert "Failed to fetch file from URL" in str(exc_info.value)
        assert "404" in str(exc_info.value)


class TestUploadBytesToS3:
    """Test cases for _upload_bytes_to_s3 function."""

    @patch("composio.core.models._files.requests.put")
    def test_upload_bytes_to_s3_success(self, mock_put):
        """Test successful upload to S3."""
        mock_client = MagicMock()
        mock_s3_response = MagicMock()
        mock_s3_response.key = "s3-key-123"
        mock_s3_response.new_presigned_url = "https://s3.example.com/upload"
        mock_client.post.return_value = mock_s3_response

        mock_put_response = MagicMock()
        mock_put_response.status_code = 200
        mock_put.return_value = mock_put_response

        result = _upload_bytes_to_s3(
            client=mock_client,
            filename="test.jpg",
            content=b"file content",
            mimetype="image/jpeg",
            tool="TEST_TOOL",
            toolkit="test_toolkit",
        )

        assert result == "s3-key-123"
        mock_client.post.assert_called_once()
        mock_put.assert_called_once()

    @patch("composio.core.models._files.requests.put")
    def test_upload_bytes_to_s3_failure(self, mock_put):
        """Test error handling when S3 upload fails."""
        mock_client = MagicMock()
        mock_s3_response = MagicMock()
        mock_s3_response.key = "s3-key-123"
        mock_s3_response.new_presigned_url = "https://s3.example.com/upload"
        mock_client.post.return_value = mock_s3_response

        mock_put_response = MagicMock()
        mock_put_response.status_code = 500
        mock_put.return_value = mock_put_response

        with pytest.raises(ErrorUploadingFile) as exc_info:
            _upload_bytes_to_s3(
                client=mock_client,
                filename="test.jpg",
                content=b"file content",
                mimetype="image/jpeg",
                tool="TEST_TOOL",
                toolkit="test_toolkit",
            )

        assert "Failed to upload to S3" in str(exc_info.value)


class TestFileUploadableFromUrl:
    """Test cases for FileUploadable.from_url and from_path with URLs."""

    @patch("composio.core.models._files._upload_bytes_to_s3")
    @patch("composio.core.models._files._fetch_file_from_url")
    def test_from_url_success(self, mock_fetch, mock_upload):
        """Test successful FileUploadable creation from URL."""
        mock_fetch.return_value = ("image.jpg", b"image data", "image/jpeg")
        mock_upload.return_value = "s3-key-abc"
        mock_client = MagicMock()

        result = FileUploadable.from_url(
            client=mock_client,
            url="https://example.com/image.jpg",
            tool="TEST_TOOL",
            toolkit="test_toolkit",
        )

        assert result.name == "image.jpg"
        assert result.mimetype == "image/jpeg"
        assert result.s3key == "s3-key-abc"
        mock_fetch.assert_called_once_with("https://example.com/image.jpg")
        mock_upload.assert_called_once()

    @patch("composio.core.models._files._upload_bytes_to_s3")
    @patch("composio.core.models._files._fetch_file_from_url")
    def test_from_path_detects_url(self, mock_fetch, mock_upload):
        """Test that from_path correctly detects and handles URLs."""
        mock_fetch.return_value = ("photo.png", b"photo data", "image/png")
        mock_upload.return_value = "s3-key-xyz"
        mock_client = MagicMock()

        result = FileUploadable.from_path(
            client=mock_client,
            file="https://images.example.com/photo.png",
            tool="SEND_EMAIL",
            toolkit="gmail",
        )

        assert result.name == "photo.png"
        assert result.mimetype == "image/png"
        assert result.s3key == "s3-key-xyz"
        mock_fetch.assert_called_once_with("https://images.example.com/photo.png")

    @patch("composio.core.models._files._fetch_file_from_url")
    def test_from_url_propagates_fetch_error(self, mock_fetch):
        """Test that fetch errors are propagated correctly."""
        mock_fetch.side_effect = ErrorUploadingFile("Fetch failed")
        mock_client = MagicMock()

        with pytest.raises(ErrorUploadingFile) as exc_info:
            FileUploadable.from_url(
                client=mock_client,
                url="https://example.com/missing.jpg",
                tool="TEST_TOOL",
                toolkit="test_toolkit",
            )

        assert "Fetch failed" in str(exc_info.value)


class TestFileHelperWithUrls:
    """Test cases for FileHelper handling URLs in file uploads."""

    @patch("composio.core.models._files.FileUploadable.from_path")
    def test_substitute_file_uploads_with_url(
        self, mock_from_path, file_helper, mock_tool
    ):
        """Test that URLs are correctly processed in substitute_file_uploads."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "attachment": {"type": "string", "file_uploadable": True},
            },
        }

        mock_uploadable = MagicMock()
        mock_uploadable.model_dump.return_value = {
            "name": "image.jpg",
            "mimetype": "image/jpeg",
            "s3key": "s3-key-123",
        }
        mock_from_path.return_value = mock_uploadable

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={"attachment": "https://example.com/image.jpg"},
        )

        assert result["attachment"] == {
            "name": "image.jpg",
            "mimetype": "image/jpeg",
            "s3key": "s3-key-123",
        }
        mock_from_path.assert_called_once()

    @patch("composio.core.models._files.FileUploadable.from_path")
    def test_substitute_file_uploads_with_url_in_anyof(
        self, mock_from_path, file_helper, mock_tool
    ):
        """Test URL handling in anyOf schema variants."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "file": {
                    "anyOf": [
                        {"type": "string", "file_uploadable": True},
                        {"type": "null"},
                    ]
                },
            },
        }

        mock_uploadable = MagicMock()
        mock_uploadable.model_dump.return_value = {
            "name": "doc.pdf",
            "mimetype": "application/pdf",
            "s3key": "s3-key-456",
        }
        mock_from_path.return_value = mock_uploadable

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={"file": "https://docs.example.com/doc.pdf"},
        )

        assert result["file"] == {
            "name": "doc.pdf",
            "mimetype": "application/pdf",
            "s3key": "s3-key-456",
        }

    @patch("composio.core.models._files.FileUploadable.from_path")
    def test_substitute_file_uploads_array_with_urls(
        self, mock_from_path, file_helper, mock_tool
    ):
        """Test URL handling in arrays with file_uploadable items."""
        mock_tool.input_parameters = {
            "type": "object",
            "properties": {
                "attachments": {
                    "type": "array",
                    "items": {"type": "string", "file_uploadable": True},
                },
            },
        }

        mock_uploadable1 = MagicMock()
        mock_uploadable1.model_dump.return_value = {
            "name": "file1.jpg",
            "mimetype": "image/jpeg",
            "s3key": "key1",
        }
        mock_uploadable2 = MagicMock()
        mock_uploadable2.model_dump.return_value = {
            "name": "file2.png",
            "mimetype": "image/png",
            "s3key": "key2",
        }
        mock_from_path.side_effect = [mock_uploadable1, mock_uploadable2]

        result = file_helper._substitute_file_uploads_recursively(
            tool=mock_tool,
            schema=mock_tool.input_parameters,
            request={
                "attachments": [
                    "https://example.com/file1.jpg",
                    "https://example.com/file2.png",
                ]
            },
        )

        assert len(result["attachments"]) == 2
        assert result["attachments"][0]["s3key"] == "key1"
        assert result["attachments"][1]["s3key"] == "key2"
