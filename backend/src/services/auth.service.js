import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { getPool, sql } from "../db/sqlserver.js";
import {
  FIND_COLLABORATOR_PROFILE,
  FIND_COLLABORATOR_PROFILE_BY_EMPLOYEE,
  FIND_USER_BY_USERNAME
} from "../queries/auth.queries.js";
import { comparePassword } from "../utils/passwords.js";

function buildSession(profile) {
  return {
    idEmployee: profile.id_employee,
    idPerson: profile.id_person,
    idUser: profile.id_user,
    username: profile.username,
    fullName: profile.full_name,
    country: {
      id: profile.id_country,
      name: profile.country_name,
      code: profile.country_code
    },
    businessUnit: {
      id: profile.id_business_unit,
      name: profile.business_unit_name,
      code: profile.business_unit_code,
      parentId: profile.parent_business_unit_id,
      parentName: profile.parent_business_unit_name
    },
    branch: {
      id: profile.id_branch,
      businessName: profile.branch_business_name,
      legalName: profile.branch_legal_name
    }
  };
}

function normalizeProfile(row) {
  return {
    idEmployee: row.id_employee,
    employeeStatus: row.employee_status,
    admissionDate: row.admission_date,
    terminationDate: row.termination_date,
    registrationDate: row.registration_date,
    idPerson: row.id_person,
    name: row.name,
    middleName: row.middle_name,
    thirdName: row.third_name,
    lastName: row.last_name,
    secondLastName: row.second_last_name,
    marriedLastName: row.married_last_name,
    fullName: row.full_name,
    personalEmail: row.personal_email,
    profileImage: row.profile_image,
    idUser: row.id_user,
    username: row.username,
    intranetEmail: row.intranet_email,
    userStatus: row.user_status,
    lastLogin: row.last_login,
    country: {
      id: row.id_country,
      name: row.country_name,
      code: row.country_code
    },
    position: {
      id: row.id_position,
      name: row.position_name
    },
    department: {
      id: row.id_department,
      name: row.department_name
    },
    businessName: {
      id: row.id_business_name,
      name: row.business_name
    },
    businessUnit: {
      id: row.id_business_unit,
      name: row.business_unit_name,
      code: row.business_unit_code,
      parentId: row.parent_business_unit_id,
      parentName: row.parent_business_unit_name
    },
    branch: {
      id: row.id_branch,
      businessName: row.branch_business_name,
      legalName: row.branch_legal_name
    },
    location: {
      suburb: row.sepomex_suburb,
      municipality: row.sepomex_municipality,
      city: row.sepomex_city,
      state: row.sepomex_state,
      postalCode: row.sepomex_postal_code
    },
    phones: {
      primary: row.primary_phone,
      all: row.all_phones
    }
  };
}

async function getCollaboratorProfileByPersonId(idPerson) {
  const pool = await getPool();
  const profileResult = await pool
    .request()
    .input("idPerson", sql.Int, idPerson)
    .query(FIND_COLLABORATOR_PROFILE);

  return profileResult.recordset[0] || null;
}

async function getCollaboratorProfileByEmployeeId(idEmployee) {
  const pool = await getPool();
  const profileResult = await pool
    .request()
    .input("idEmployee", sql.Int, idEmployee)
    .query(FIND_COLLABORATOR_PROFILE_BY_EMPLOYEE);

  return profileResult.recordset[0] || null;
}

export async function loginWithIntranetCredentials(username, password) {
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || !normalizedPassword) {
    throw new Error("Usuario y contraseña son requeridos.");
  }

  const pool = await getPool();
  const userResult = await pool
    .request()
    .input("username", sql.VarChar, normalizedUsername)
    .query(FIND_USER_BY_USERNAME);

  const user = userResult.recordset[0];
  if (!user) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  if (Number(user.status) !== 1) {
    throw new Error("El usuario de intranet no está activo.");
  }

  const passwordOk = await comparePassword(normalizedPassword, user.password);
  if (!passwordOk) {
    throw new Error("Usuario o contraseña incorrectos.");
  }

  const profileRow = await getCollaboratorProfileByPersonId(user.id_person);
  if (!profileRow) {
    throw new Error("No se encontró un colaborador activo vinculado a este usuario.");
  }

  const profile = normalizeProfile(profileRow);
  const session = buildSession(profileRow);

  const token = jwt.sign(session, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });

  return {
    token,
    profile
  };
}

export async function getManualRegistrationProfile(idEmployee) {
  const parsedIdEmployee = Number(idEmployee);
  if (!Number.isInteger(parsedIdEmployee) || parsedIdEmployee <= 0) {
    throw new Error("El ID de empleado es inválido.");
  }

  const profileRow = await getCollaboratorProfileByEmployeeId(parsedIdEmployee);
  if (!profileRow) {
    throw new Error("No se encontró un colaborador activo con ese ID de empleado.");
  }

  if (Number(profileRow.id_user || 0) > 0 && Number(profileRow.user_status) === 1) {
    throw new Error("Este colaborador ya tiene usuario de intranet activo. Debe iniciar sesión con intranet.");
  }

  return normalizeProfile(profileRow);
}
