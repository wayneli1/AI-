SELECT pa.attachment_type, pa.file_url, pp.name 
FROM personnel_attachments pa 
JOIN personnel_profiles pp ON pa.personnel_profile_id = pp.id 
WHERE pa.enabled = true
LIMIT 20;