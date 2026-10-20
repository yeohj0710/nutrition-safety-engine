Task: relevance judging for a retrieval evaluation. Work only in this folder.

Read judge/instructions.md, rubric.json and judge_items.json (130 items). Judge every item yourself by reading its title and abstract, following judge/instructions.md and the axis tests in rubric.json. Do not write keyword or regex heuristics, do not call any API, do not skip items. Work in chunks if needed, but every label must come from your own reading.

Write the result to judge/judgments_codex.json as one JSON array of 130 objects in the shape given in judge/instructions.md (item_id, topic, axes, reason). Validate that the file parses, has 130 items, every item_id appears once, and every axis in each item's axis_checks has a yes/no answer. Do not modify any other file.
