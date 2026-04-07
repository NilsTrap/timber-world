export { getOrganisations } from "./getOrganisations";
export { getOrganisationById } from "./getOrganisationById";
export { createOrganisation } from "./createOrganisation";
export { updateOrganisation } from "./updateOrganisation";
export { toggleOrganisation } from "./toggleOrganisation";
export { toggleOrganisationExternal } from "./toggleOrganisationExternal";
export { deleteOrganisation } from "./deleteOrganisation";
export { getOrgShipmentCount } from "./getOrgShipmentCount";

// User management actions (Story 7.2)
export { getOrganisationUsers } from "./getOrganisationUsers";
export { createOrganisationUser } from "./createOrganisationUser";
export { updateOrganisationUser } from "./updateOrganisationUser";
export { toggleUserActive } from "./toggleUserActive";
export { deleteOrganisationUser } from "./deleteOrganisationUser";

// Add existing user to organisation
export { searchUserByEmail, addExistingUserToOrganisation } from "./addExistingUserToOrganisation";
export type { ExistingUserInfo } from "./addExistingUserToOrganisation";

// User credential actions (Story 7.3)
export { sendUserCredentials } from "./sendUserCredentials";

// Resend/Reset credential actions (Story 7.4)
export { resendUserCredentials } from "./resendUserCredentials";
export { resetUserPassword } from "./resetUserPassword";

// User module management (replaces roles + overrides)
export { getUserModules, updateUserModules } from "./getUserPermissions";
export type { UserModule } from "./getUserPermissions";

// Legacy re-exports for backward compatibility
export { getUserPermissions, updateUserPermissions } from "./getUserPermissions";
export type { UserPermission, OverrideState } from "./getUserPermissions";
export { getUserRoles, updateUserRoles } from "./getUserRoles";
export type { UserRoleAssignment } from "./getUserRoles";

// Organisation modules (Story 10.12)
export { getOrganisationModules, updateOrganisationModules } from "./getOrganisationModules";
export type { OrganisationModule } from "./getOrganisationModules";

// Module presets
export { getModulePresets, createModulePreset, deleteModulePreset } from "./modulePresets";
export type { ModulePreset } from "./modulePresets";

// Trading partners
export { getTradingPartners } from "./getTradingPartners";
export { addTradingPartner } from "./addTradingPartner";
export { removeTradingPartner } from "./removeTradingPartner";
export { getAvailablePartners } from "./getAvailablePartners";

// People (all users across organisations)
export { getAllPeople } from "./getAllPeople";
export type { Person } from "./getAllPeople";

// Per-org reference data exclusions
export { getOrgRefExclusions } from "./getOrgRefExclusions";
export { updateOrgRefExclusions } from "./updateOrgRefExclusions";

// Delivery addresses
export { getDeliveryAddresses, saveDeliveryAddress, deleteDeliveryAddress } from "./deliveryAddresses";

// Logo upload
export { uploadOrgLogo } from "./uploadOrgLogo";
