// original code by somesh, written by hand

import { config } from '../config';
import * as mock from './mockData';
import * as postgres from './postgresData';

// matching reads here, postgres if configured, else in memory
const source = config.useMockData ? mock : postgres;

export const getCourseProfiles = source.getCourseProfiles;
export const getAverages = source.getAverages;
export const isEnrolled = source.isEnrolled;
