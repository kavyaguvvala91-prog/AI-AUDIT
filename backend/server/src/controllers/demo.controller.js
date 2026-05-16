const demoService = require("../services/demo.service");
const { buildGovernanceDashboardForDataset } = require("./mlops.controller");
const { sendSuccess } = require("../utils/apiResponse");

const loadDemo = async (_req, res) => {
  const demo = await demoService.loadDemoDatasets();
  return sendSuccess(res, {
    message: "Loan prediction demo datasets loaded",
    data: demo,
  });
};

const analyzeDemo = async (_req, res) => {
  const demo = await demoService.prepareDemoAnalysis();
  return sendSuccess(res, {
    message: "Loan prediction demo analysis prepared",
    data: demo,
  });
};

const governanceDemo = async (req, res) => {
  const demo = await demoService.prepareDemoAnalysis();
  const dashboard = await buildGovernanceDashboardForDataset(demo.currentDatasetId, {
    referenceDatasetId: demo.referenceDatasetId,
    targetColumn: demo.targetColumn,
    sensitiveAttributes: demo.sensitiveAttributes,
    preferredProvider: req.query.preferredProvider || null,
  });

  return sendSuccess(res, {
    message: "Loan prediction governance demo is ready",
    data: {
      ...demo,
      dashboard,
    },
  });
};

module.exports = {
  loadDemo,
  analyzeDemo,
  governanceDemo,
};
