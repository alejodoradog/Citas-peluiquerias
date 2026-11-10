-- Task 2.3, after its CI run: the barbers_photo_in_own_folder check calls
-- private.is_image_key, and a check runs with the privileges of whoever
-- writes the row. Server jobs (service_role) write barbers too, as they
-- already may call private.is_email (20261105025014_email_as_only_channel).

grant execute on function private.is_image_key(text) to service_role;
