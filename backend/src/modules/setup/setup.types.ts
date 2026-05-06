export type SetupStatusResponse = {
  setupCompleted: boolean;
  hasFirstUser: boolean;
  hasAdminUser: boolean;
  hasTenant: boolean;
  hasStore: boolean;
};

export type FirstUserSetupInput = {
  fullName?: string;
  email?: string;
  password?: string;
};

export type CompanySetupInput = {
  name?: string;
  abbreviation?: string | null;
};

export type InitialSetupInput = {
  firstUser?: FirstUserSetupInput;
  company?: CompanySetupInput;
};

export type InitialSetupResponse = {
  success: boolean;
  setupCompleted: boolean;
  redirectTo: string;
  message: string;
};
