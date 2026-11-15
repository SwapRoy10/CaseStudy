import { config } from '../config';
import * as mock from './mockData';
import * as postgres from './postgresData';

// matching reads through this file. it uses the postgres queries when a database
// is configured and the short in-memory list otherwise, so the demo still runs
// without one (see USE_MOCK_DATA in backend/.env.example).
const source = config.useMockData ? mock : postgres;

export const getCourseProfiles = source.getCourseProfiles;
export const getAverages = source.getAverages;
export const isEnrolled = source.isEnrolled;
