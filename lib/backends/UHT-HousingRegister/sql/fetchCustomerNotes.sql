SELECT
	*
FROM
	conlog
	JOIN wlapp ON wlapp.con_key = conlog.con_key
	JOIN wlmember ON wlmember.app_ref = wlapp.app_ref
WHERE
	wlmember.app_ref = @app_ref
	AND wlmember.person_no = @person_no