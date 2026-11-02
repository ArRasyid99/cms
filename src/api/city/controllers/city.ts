import { factories } from '@strapi/strapi';

const OFFICE_SPACE_UID = 'api::office-space.office-space';

async function attachOfficeCount(city: any) {
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

export default factories.createCoreController('api::city.city', () => ({
  async find(ctx) {
    const response: any = await super.find(ctx);

    if (!response?.data) {
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
    const response: any = await super.findOne(ctx);

    if (!response?.data) {
      return response;
    }

    return {
      ...response,
      data: await attachOfficeCount(response.data),
    };
  },
}));
