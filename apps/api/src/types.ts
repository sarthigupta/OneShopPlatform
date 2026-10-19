export type ApiError = {
  error: string;
  details?: string[];
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
};
