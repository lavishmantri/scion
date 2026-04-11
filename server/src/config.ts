// Centralized configuration with environment variable support

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  vaultPath: process.env.VAULT_PATH || './vault',
  axiomToken: process.env.AXIOM_TOKEN || '',
  axiomDataset: process.env.AXIOM_DATASET || '',
  axiomDatasetRequests: process.env.AXIOM_DATASET_REQUESTS || '',
};
