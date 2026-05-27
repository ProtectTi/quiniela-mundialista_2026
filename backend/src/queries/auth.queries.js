export const FIND_USER_BY_USERNAME = `
SELECT TOP 1
    u.id_user,
    u.id_person,
    u.username,
    u.email,
    u.password,
    u.status,
    u.last_login
FROM core_users u
WHERE LOWER(u.username) = LOWER(@username)
ORDER BY
    CASE WHEN u.status = 1 THEN 0 ELSE 1 END,
    ISNULL(u.last_login, '19000101') DESC,
    u.id_user DESC;
`;

export const FIND_COLLABORATOR_PROFILE = `
SELECT
    e.id_employee,
    e.status AS employee_status,
    e.admission_date,
    e.termination_date,
    e.registration_date,

    p.id_person,
    p.name,
    p.middle_name,
    p.third_name,
    p.last_name,
    p.second_last_name,
    p.married_last_name,
    LTRIM(RTRIM(CONCAT(
        ISNULL(p.name, ''),
        CASE WHEN ISNULL(p.middle_name, '') <> '' THEN ' ' + p.middle_name ELSE '' END,
        CASE WHEN ISNULL(p.third_name, '') <> '' THEN ' ' + p.third_name ELSE '' END,
        CASE WHEN ISNULL(p.last_name, '') <> '' THEN ' ' + p.last_name ELSE '' END,
        CASE WHEN ISNULL(p.second_last_name, '') <> '' THEN ' ' + p.second_last_name ELSE '' END,
        CASE WHEN ISNULL(p.married_last_name, '') <> '' THEN ' de ' + p.married_last_name ELSE '' END
    ))) AS full_name,
    p.email AS personal_email,
    p.profile_image,

    ux.id_user,
    ux.username,
    ux.intranet_email,
    ux.user_status,
    ux.last_login,

    c.id_country,
    c.name AS country_name,
    c.nomenclature AS country_code,

    pos.id_position,
    pos.name AS position_name,

    dep.id_department,
    dep.name AS department_name,

    bn.id_business_name,
    bn.name AS business_name,

    bu.id_business_unit,
    bu.name AS business_unit_name,
    bu.nomenclature AS business_unit_code,
    bu_parent.id_business_unit AS parent_business_unit_id,
    bu_parent.name AS parent_business_unit_name,

    br.id_branch,
    br.business_name AS branch_business_name,
    br.name AS branch_legal_name,

    sx.suburb AS sepomex_suburb,
    sx.municipality AS sepomex_municipality,
    sx.city AS sepomex_city,
    sx.state AS sepomex_state,
    sx.id_postal_code AS sepomex_postal_code,

    phone.primary_phone,
    phone.all_phones
FROM core_employees e
INNER JOIN core_persons p
    ON p.id_person = e.id_person
LEFT JOIN core_employee_profile_details epd
    ON epd.id_employee_profile_detail = e.id_employee_profile_detail
LEFT JOIN core_countries c
    ON c.id_country = epd.id_country
LEFT JOIN core_positions pos
    ON pos.id_position = epd.id_position
LEFT JOIN core_departments dep
    ON dep.id_department = epd.id_department
LEFT JOIN core_business_names bn
    ON bn.id_business_name = epd.id_business_name
LEFT JOIN core_business_units bu
    ON bu.id_business_unit = epd.id_business_unit
LEFT JOIN core_business_units bu_parent
    ON bu_parent.id_business_unit = bu.id_parent
LEFT JOIN core_branches br
    ON br.id_branch = epd.id_branch
LEFT JOIN core_sepomex sx
    ON sx.id_suburb = br.id_suburb
OUTER APPLY (
    SELECT TOP 1
        u.id_user,
        u.username,
        u.email AS intranet_email,
        u.status AS user_status,
        u.last_login
    FROM core_users u
    WHERE u.id_person = p.id_person
      AND u.status = 1
    ORDER BY ISNULL(u.last_login, '19000101') DESC, u.id_user DESC
) ux
OUTER APPLY (
    SELECT
        MAX(CASE WHEN rn = 1 THEN number END) AS primary_phone,
        STUFF((
            SELECT ', ' + pp.number
            FROM core_person_phones pp
            WHERE pp.id_person = p.id_person
              AND pp.status = 1
            ORDER BY pp.id_person_phone DESC
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, '') AS all_phones
    FROM (
        SELECT pp.number,
               ROW_NUMBER() OVER (ORDER BY pp.id_person_phone DESC) AS rn
        FROM core_person_phones pp
        WHERE pp.id_person = p.id_person
          AND pp.status = 1
    ) ph
) phone
WHERE p.id_person = @idPerson
  AND e.status = 1
ORDER BY e.id_employee DESC;
`;

export const FIND_COLLABORATOR_PROFILE_BY_EMPLOYEE = `
SELECT
    e.id_employee,
    e.status AS employee_status,
    e.admission_date,
    e.termination_date,
    e.registration_date,

    p.id_person,
    p.name,
    p.middle_name,
    p.third_name,
    p.last_name,
    p.second_last_name,
    p.married_last_name,
    LTRIM(RTRIM(CONCAT(
        ISNULL(p.name, ''),
        CASE WHEN ISNULL(p.middle_name, '') <> '' THEN ' ' + p.middle_name ELSE '' END,
        CASE WHEN ISNULL(p.third_name, '') <> '' THEN ' ' + p.third_name ELSE '' END,
        CASE WHEN ISNULL(p.last_name, '') <> '' THEN ' ' + p.last_name ELSE '' END,
        CASE WHEN ISNULL(p.second_last_name, '') <> '' THEN ' ' + p.second_last_name ELSE '' END,
        CASE WHEN ISNULL(p.married_last_name, '') <> '' THEN ' de ' + p.married_last_name ELSE '' END
    ))) AS full_name,
    p.email AS personal_email,
    p.profile_image,

    ux.id_user,
    ux.username,
    ux.intranet_email,
    ux.user_status,
    ux.last_login,

    c.id_country,
    c.name AS country_name,
    c.nomenclature AS country_code,

    pos.id_position,
    pos.name AS position_name,

    dep.id_department,
    dep.name AS department_name,

    bn.id_business_name,
    bn.name AS business_name,

    bu.id_business_unit,
    bu.name AS business_unit_name,
    bu.nomenclature AS business_unit_code,
    bu_parent.id_business_unit AS parent_business_unit_id,
    bu_parent.name AS parent_business_unit_name,

    br.id_branch,
    br.business_name AS branch_business_name,
    br.name AS branch_legal_name,

    sx.suburb AS sepomex_suburb,
    sx.municipality AS sepomex_municipality,
    sx.city AS sepomex_city,
    sx.state AS sepomex_state,
    sx.id_postal_code AS sepomex_postal_code,

    phone.primary_phone,
    phone.all_phones
FROM core_employees e
INNER JOIN core_persons p
    ON p.id_person = e.id_person
LEFT JOIN core_employee_profile_details epd
    ON epd.id_employee_profile_detail = e.id_employee_profile_detail
LEFT JOIN core_countries c
    ON c.id_country = epd.id_country
LEFT JOIN core_positions pos
    ON pos.id_position = epd.id_position
LEFT JOIN core_departments dep
    ON dep.id_department = epd.id_department
LEFT JOIN core_business_names bn
    ON bn.id_business_name = epd.id_business_name
LEFT JOIN core_business_units bu
    ON bu.id_business_unit = epd.id_business_unit
LEFT JOIN core_business_units bu_parent
    ON bu_parent.id_business_unit = bu.id_parent
LEFT JOIN core_branches br
    ON br.id_branch = epd.id_branch
LEFT JOIN core_sepomex sx
    ON sx.id_suburb = br.id_suburb
OUTER APPLY (
    SELECT TOP 1
        u.id_user,
        u.username,
        u.email AS intranet_email,
        u.status AS user_status,
        u.last_login
    FROM core_users u
    WHERE u.id_person = p.id_person
      AND u.status = 1
    ORDER BY ISNULL(u.last_login, '19000101') DESC, u.id_user DESC
) ux
OUTER APPLY (
    SELECT
        MAX(CASE WHEN rn = 1 THEN number END) AS primary_phone,
        STUFF((
            SELECT ', ' + pp.number
            FROM core_person_phones pp
            WHERE pp.id_person = p.id_person
              AND pp.status = 1
            ORDER BY pp.id_person_phone DESC
            FOR XML PATH(''), TYPE
        ).value('.', 'nvarchar(max)'), 1, 2, '') AS all_phones
    FROM (
        SELECT pp.number,
               ROW_NUMBER() OVER (ORDER BY pp.id_person_phone DESC) AS rn
        FROM core_person_phones pp
        WHERE pp.id_person = p.id_person
          AND pp.status = 1
    ) ph
) phone
WHERE e.id_employee = @idEmployee
  AND e.status = 1
ORDER BY e.id_employee DESC;
`;
