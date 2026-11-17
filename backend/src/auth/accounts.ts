import { config } from '../config';
import * as mock from './mockAccounts';
import * as postgres from './postgresAccounts';

// sign in reads through this file. same idea as matching/data.ts: postgres when
// a database is configured, the in memory sample students otherwise.
const source = config.useMockData ? mock : postgres;

export const findAccountByEmail = source.findAccountByEmail;
export const findAccountById = source.findAccountById;
export const setPasswordHash = source.setPasswordHash;
export const markTutorialComplete = source.markTutorialComplete;
export const getMe = source.getMe;
