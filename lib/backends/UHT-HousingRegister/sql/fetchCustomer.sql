SELECT
	wlmember.*,
	wlapp.u_novalet_ref,
	wlapp.app_band,
	wlapp.post_code,
	wlapp.corr_addr
FROM
[dbo].[wlmember] AS wlmember
JOIN wlapp ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlapp.app_ref = wlmember.app_ref
	AND wlmember.app_ref = @app_ref
	AND wlmember.person_no = @person_no