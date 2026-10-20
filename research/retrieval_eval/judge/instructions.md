You are judging search results from a literature lookup tool for dietary supplement safety. Judge each item independently from its title and abstract only. Do not use outside knowledge about the paper.

For each item:

1. topic: does the record match the situation question given in "question"?
   - "relevant": the study population (or case) is in that clinical situation AND the exposure or subject includes a dietary supplement, vitamin, mineral, herbal product, or nutritional product (oral or parenteral nutrition products count).
   - "partial": only one side clearly matches (e.g. right population but the product is a drug, not a supplement; or the supplement is studied in a general population with the situation only mentioned in passing), or the study is non-human/mechanistic but directly on the situation and a supplement.
   - "irrelevant": neither side matches, or the match is only a keyword coincidence.
2. axes: for every axis listed in "axis_checks", answer "yes" or "no" using the axis test from the rubric. Judge only whether the abstract states that information, not whether it is useful.
3. reason: at most 20 English words explaining the topic label.

Output: a JSON array, one object per item, in the same order, exactly this shape:
{"item_id": "I001", "topic": "relevant", "axes": {"dose_range": "yes"}, "reason": "..."}
If axis_checks is empty, "axes" is {}. Output nothing but the JSON array.
