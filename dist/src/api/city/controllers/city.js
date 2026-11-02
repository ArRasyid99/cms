"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strapi_1 = require("@strapi/strapi");
const OFFICE_SPACE_UID = 'api::office-space.office-space';
async function attachOfficeCount(city) {
    if (!city) {
        return city;
    }
    const officeCount = await strapi.documents(OFFICE_SPACE_UID).count({
        filters: {
            city: {
                documentId: city.documentId,
            },
        },
        status: 'published',
    });
    return {
        ...city,
        officeCount,
    };
}
exports.default = strapi_1.factories.createCoreController('api::city.city', () => ({
    async find(ctx) {
        const response = await super.find(ctx);
        if (!(response === null || response === void 0 ? void 0 : response.data)) {
            return response;
        }
        if (Array.isArray(response.data)) {
            return {
                ...response,
                data: await Promise.all(response.data.map(attachOfficeCount)),
            };
        }
        return {
            ...response,
            data: await attachOfficeCount(response.data),
        };
    },
    async findOne(ctx) {
        const response = await super.findOne(ctx);
        if (!(response === null || response === void 0 ? void 0 : response.data)) {
            return response;
        }
        return {
            ...response,
            data: await attachOfficeCount(response.data),
        };
    },
}));
