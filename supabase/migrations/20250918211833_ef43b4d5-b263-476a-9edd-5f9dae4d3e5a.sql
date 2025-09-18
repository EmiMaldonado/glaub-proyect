-- Force clear team recommendations cache to regenerate with new sharing permissions
DELETE FROM manager_recommendations WHERE manager_id = '42dc90c4-bc73-4cd5-bddc-46dea219c9cd';