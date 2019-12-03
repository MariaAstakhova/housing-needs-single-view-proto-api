SELECT
	hbclaimnotes.*
FROM
	hbclaim
	JOIN hbclaimnotes ON hbclaimnotes.string_id = cast(
		right(hbclaim.notes_db_handle, len (hbclaim.notes_db_handle) - 13) AS integer)
WHERE
	hbclaim.claim_id = @claim_id
ORDER BY hbclaimnotes.row_sequence ASC