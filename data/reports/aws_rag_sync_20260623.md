# AWS RAG Sync 20260623

## Targets

- AWS account: 085710593039
- Region: us-east-1
- S3 bucket: `draftops-rag-085710593039-us-east-1` (existing)
- DynamoDB table: `DraftOpsPlayerFeatureReference124` (existing)

## Vector Index

- Rebuilt manifest indexes: 5
- Total chunks: 1336
- Prospect evidence chunks: 820
- Embedding provider: local-hash
- Embedding dimensions: 256
- Feature-reference chunks: 180
- Online-reverification chunks: 180

## S3 Objects

| Key | SHA-256 |
| --- | --- |
| data/rag/rag-core-board.json | 7F841EFCCB7C8839665AB74A261381C106D6EB98B1DB392CAA29F29CB8DD09E5 |
| data/rag/rag-team-preference.json | 38DA89A1C22B64F4EB9181B1F9C7FA35AB9A3D1185E7ECDF9B94B71B842ECE29 |
| data/rag/rag-prospect-evidence.json | A66BE2BA40245AC2B755306B1DA947261C97E48DED54474E5C400ADBAF2F0366 |
| data/rag/rag-milestone.json | 66849A5FAD6B0D2B5819C10145CA29E5290FBDA0447528DDCE70FEA7BE7E60A0 |
| data/rag/rag-architecture.json | 2FCE706F718DE5E1F2E6326938B803021A2E855896A267B119B06FAB4A7B4776 |
| data/rag/rag-manifest.json | C02C29920D31328FEE5EB3710EDA02BB469474AB3731F1DBBA5E9FAB60030B58 |
| data/normalized/normalized_2026_local_player_pool_124.json | B08C276C6EF8A64B2026EC12B88B317237DBBF57E2F471E76C3178A8F13598B7 |
| data/normalized/normalized_2026_player_feature_reference_124.json | 294F30DFC7606B406D3941F54D0ADDEDA0DCBF18C9FB702E48EFA2E8EA037BB9 |
| data/normalized/normalized_2026_online_player_list_reverification_20260623.json | 17CC976ECB25515BAF626028AE89E0CD806E6A4DE76B0BD093D636023C1B9D02 |
| data/reports/player_feature_parameter_reference_124_20260623.md | 9AC86161C513D22AE35FAD36843912ABBE4CA23F0231340725104F5A2AE3A9E2 |
| data/reports/player_feature_parameter_reference_124_20260623.csv | B5EFC05E988621EDD9F0E6284F5973331668FAA08578CEE3C916B83DEE5D72AF |
| data/reports/online_full_player_list_reverification_20260623.md | DFF8EEB6F3DB0779ECD61051D3E5203689775E04D0A1AB57C2F3D7B19A6C606F |

## DynamoDB

- Player feature records written: 124
- Table item count from realtime scan: 124
- Table item count from describe-table may lag; latest describe value: 0
- Key schema: `playerKey`
- Includes top-level age, barefoot height, wingspan, weight, reference score, and full nested feature record.

## Runtime Env

Use these non-secret values for deployed Lambda/local RAG:

```env
DRAFTOPS_RAG_S3_BUCKET=draftops-rag-085710593039-us-east-1
DRAFTOPS_RAG_DYNAMODB_TABLES=DraftOpsPlayerFeatureReference124
DRAFTOPS_RAG_S3_KEYS=data/rag/rag-core-board.json,data/rag/rag-team-preference.json,data/rag/rag-prospect-evidence.json,data/rag/rag-milestone.json,data/rag/rag-architecture.json,data/rag/rag-manifest.json,data/normalized/normalized_2026_local_player_pool_124.json,data/normalized/normalized_2026_player_feature_reference_124.json,data/normalized/normalized_2026_online_player_list_reverification_20260623.json
```
