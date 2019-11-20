SELECT
	wlmember.app_ref,
	wlmember.person_no,
	wlmember.forename,
	wlmember.surname,
	wlmember.dob,
	wlmember.ni_no,
	wlapp.post_code,
	wlapp.corr_addr,
	wlapp.con_key
FROM
[dbo].[wlmember]
JOIN [dbo].[wlapp] AS wlapp
	ON wlmember.app_ref = wlapp.app_ref
JOIN [dbo].[contacts] AS contacts
	ON contacts.con_ref = wlapp.app_ref