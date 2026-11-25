import { config } from './config';
import * as memoryGroups from './memory/groups';
import * as memoryProfiles from './memory/profiles';
import * as memoryRequests from './memory/requests';
import * as memoryReviews from './memory/reviews';
import * as postgresProfiles from './profile/profile.service';
import * as postgresGroups from './requests/groups.service';
import * as postgresRequests from './requests/requests.service';
import * as postgresReviews from './reviews/reviews.service';

// postgres services when a database is set, else the in memory store
const memory = config.useMockData;

export const getOwnProfile = memory ? memoryProfiles.getOwnProfile : postgresProfiles.getOwnProfile;
export const saveProfile = memory ? memoryProfiles.saveProfile : postgresProfiles.saveProfile;
export const sendRequest = memory ? memoryRequests.sendRequest : postgresRequests.sendRequest;
export const listRequests = memory ? memoryRequests.listRequests : postgresRequests.listRequests;
export const respond = memory ? memoryRequests.respond : postgresRequests.respond;
export const cancel = memory ? memoryRequests.cancel : postgresRequests.cancel;
export const getGroup = memory ? memoryGroups.getGroup : postgresGroups.getGroup;
export const getMatchedProfile = memory ? memoryGroups.getMatchedProfile : postgresGroups.getMatchedProfile;
export const submitReview = memory ? memoryReviews.submitReview : postgresReviews.submitReview;
