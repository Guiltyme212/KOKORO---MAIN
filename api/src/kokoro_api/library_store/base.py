from __future__ import annotations

from abc import ABC, abstractmethod

from kokoro_api.types import LibraryItem

UserKey = int | str


class MeditationNotFoundError(LookupError):
    """Raised when a meditation_id has no meta.json in the blob store."""


class LibraryStore(ABC):
    """Per-user persistent collection of saved meditations.

    The store is keyed by Telegram user id. Library entries are summaries of
    meditations whose audio + meta still live under `meditations/<id>/...` in
    the blob store; the library file itself only carries denormalized fields
    that the UI needs to render the list (so we don't refetch meta.json on
    every browse).
    """

    name: str

    @abstractmethod
    async def list_items(self, user_key: UserKey) -> list[LibraryItem]: ...

    @abstractmethod
    async def add(self, user_key: UserKey, meditation_id: str) -> list[LibraryItem]:
        """Add a meditation to the user's library. No-op if already present.
        Raises MeditationNotFoundError if the meditation has no meta.json."""

    @abstractmethod
    async def remove(self, user_key: UserKey, meditation_id: str) -> list[LibraryItem]: ...
