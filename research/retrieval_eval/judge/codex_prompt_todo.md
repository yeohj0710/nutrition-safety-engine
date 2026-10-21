Task: relevance judging for a retrieval evaluation. Work only in this folder.

Read judge/instructions.md, rubric.json and judge_items_todo.json (104 items). Judge every item yourself by reading its title and abstract, following judge/instructions.md and the axis tests in rubric.json. Ignore the field topic_known. Do not write keyword or regex heuristics, do not call any API, do not skip items, and do not open any other judgments file.

Write the result to judge/todo_codex.json as one JSON array of objects in the shape given in judge/instructions.md (item_id, topic, axes, reason), one per item in judge_items_todo.json. Validate that the file parses, every item_id appears once, and every axis in each item's axis_checks has a yes/no answer. Do not modify any other file.
