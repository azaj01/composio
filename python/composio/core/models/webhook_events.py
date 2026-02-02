"""
Webhook event types for typed event handling.

This module provides TypedDict definitions for specific webhook event types,
enabling type-safe handling of events like connection expiration.
"""

from __future__ import annotations

import typing as t
from enum import Enum

import typing_extensions as te


class WebhookEventType(str, Enum):
    """Known webhook event types."""

    CONNECTION_EXPIRED = "composio.connected_account.expired"


class ConnectionStatusEnum(str, Enum):
    """Connection status values."""

    INITIALIZING = "INITIALIZING"
    INITIATED = "INITIATED"
    ACTIVE = "ACTIVE"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"
    INACTIVE = "INACTIVE"


# =============================================================================
# CONNECTED ACCOUNT DATA (matches GET /api/v3/connected_accounts/{id})
# =============================================================================


class ConnectedAccountToolkit(te.TypedDict):
    """Toolkit information in connected account response."""

    slug: str


class ConnectedAccountAuthConfigDeprecated(te.TypedDict, total=False):
    """Deprecated auth config fields."""

    uuid: str


class ConnectedAccountAuthConfig(te.TypedDict, total=False):
    """Auth config details in connected account response."""

    id: te.Required[str]
    auth_scheme: te.Required[str]
    is_composio_managed: te.Required[bool]
    is_disabled: te.Required[bool]
    deprecated: ConnectedAccountAuthConfigDeprecated


class ConnectionStateVal(te.TypedDict, total=False):
    """Connection state value - varies by auth scheme."""

    status: str
    # OAuth2 fields
    access_token: str
    refresh_token: t.Optional[str]
    token_type: str
    expires_in: t.Union[int, str, None]
    scope: t.Union[str, t.List[str], None]
    id_token: str
    code_verifier: str
    callback_url: str
    # OAuth1 fields
    oauth_token: str
    oauth_token_secret: str
    # API Key fields
    api_key: str
    generic_api_key: str
    # Bearer Token fields
    token: str
    # Basic auth fields
    username: str
    password: str


class ConnectionState(te.TypedDict):
    """Connection state data discriminated by auth scheme."""

    authScheme: str
    val: ConnectionStateVal


class ConnectedAccountDeprecated(te.TypedDict, total=False):
    """Deprecated connected account fields."""

    labels: t.List[str]
    uuid: str


class SingleConnectedAccountDetailedResponse(te.TypedDict, total=False):
    """
    Connected account data matching GET /api/v3/connected_accounts/{id} response.

    This is used in webhook payloads for connection lifecycle events.
    """

    toolkit: te.Required[ConnectedAccountToolkit]
    auth_config: te.Required[ConnectedAccountAuthConfig]
    id: te.Required[str]
    user_id: te.Required[str]
    status: te.Required[str]  # ConnectionStatusEnum value
    created_at: te.Required[str]
    updated_at: te.Required[str]
    state: te.Required[ConnectionState]
    data: te.Required[t.Dict[str, t.Any]]
    params: te.Required[t.Dict[str, t.Any]]
    status_reason: te.Required[t.Optional[str]]
    is_disabled: te.Required[bool]
    test_request_endpoint: str
    deprecated: ConnectedAccountDeprecated


# =============================================================================
# CONNECTION EXPIRED WEBHOOK EVENT
# =============================================================================


class WebhookConnectionMetadata(te.TypedDict):
    """Webhook metadata for connection events."""

    project_id: str
    org_id: str


class ConnectionExpiredEvent(te.TypedDict):
    """
    Connection expired webhook event payload.

    Emitted when a connected account expires due to authentication refresh failure.

    Example:
        >>> from composio.core.models.webhook_events import ConnectionExpiredEvent
        >>>
        >>> def handle_webhook(payload: dict) -> None:
        ...     if payload.get("type") == "composio.connected_account.expired":
        ...         event: ConnectionExpiredEvent = payload  # type: ignore
        ...         print(f"Connection {event['data']['id']} expired")
        ...         print(f"Toolkit: {event['data']['toolkit']['slug']}")
        ...         print(f"User: {event['data']['user_id']}")
    """

    id: str  # Unique message ID (e.g., "msg_847cdfcd-d219-4f18-a6dd-91acd42ca94a")
    timestamp: str  # ISO-8601 timestamp
    type: t.Literal["composio.connected_account.expired"]
    data: SingleConnectedAccountDetailedResponse
    metadata: WebhookConnectionMetadata


# Type alias for all webhook events
WebhookEvent = t.Union[ConnectionExpiredEvent]


def is_connection_expired_event(payload: t.Dict[str, t.Any]) -> bool:
    """
    Check if a webhook payload is a connection expired event.

    :param payload: The webhook payload to check
    :return: True if this is a connection expired event

    Example:
        >>> from composio.core.models.webhook_events import (
        ...     is_connection_expired_event,
        ...     ConnectionExpiredEvent,
        ... )
        >>>
        >>> if is_connection_expired_event(payload):
        ...     event: ConnectionExpiredEvent = payload  # type: ignore
        ...     handle_connection_expired(event)
    """
    return (
        isinstance(payload, dict)
        and payload.get("type") == WebhookEventType.CONNECTION_EXPIRED.value
    )
