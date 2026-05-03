from __future__ import annotations

import pytest

from kokoro_api.templates.loader import load_templates


@pytest.mark.asyncio
async def test_loads_all_templates() -> None:
    templates = await load_templates()
    assert len(templates) >= 3

    ids = sorted(template.id for template in templates)
    assert "unwind_release_pressure_01" in ids
    assert "attract_amsterdam_morning_01" in ids
    assert "lockin_one_rep_01" in ids


@pytest.mark.asyncio
async def test_rejects_nonexistent_dir() -> None:
    with pytest.raises(FileNotFoundError):
        await load_templates(root_dir="/nonexistent")
