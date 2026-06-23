# LLM Variant Generation

Generated: 2026-06-23T13:36:29.404Z

## Outputs

- `data/agent_variants/deepseek_llm_variant_20260623.json`: DeepSeek LLM parameter rerun

## Variants

### DeepSeek LLM parameter rerun

```json
{
  "id": "deepseek-llm",
  "label": "DeepSeek LLM parameter rerun",
  "sourceAgent": "deepseek-v4-pro",
  "weakPreferencePickValueCap": 3.25,
  "featurePositiveCap": 1.15,
  "dTierAdditionalPenalty": 0.35,
  "athleticDeficitPenalty": 0.9,
  "athleticDeficitThreshold": 10,
  "athleticDeficitMaxRiskTolerance": 60,
  "rationale": [
    "Adopts mild base to preserve late-round stability (picks 27-30) seen in mild run, avoiding the disruption caused by guard rail penalties.",
    "Athletic deficit penalty reduced from 1.0 to 0.9 to slightly decrease sensitivity to low explosiveness scores, reducing volatility in prospects like Yaxel Lendeborg (explosiveness 6.3) who appeared in pick 10 margin.",
    "Weak preference cap and feature positive cap kept at mild levels (3.25, 1.15) as they balance team fit without over-amplifying pick value adjustments.",
    "D-tier additional penalty kept low (0.35) to avoid punishing data-incomplete prospects excessively, which in guard run led to tail end reshuffling."
  ],
  "fragilePicksToWatch": [
    10,
    12,
    15,
    21,
    26,
    27,
    30
  ]
}
```

## Calls

- deepseek: deepseek-v4-pro[1m]; usage={"prompt_tokens":5469,"completion_tokens":2367,"total_tokens":7836,"prompt_tokens_details":{"cached_tokens":0},"completion_tokens_details":{"reasoning_tokens":2050},"prompt_cache_hit_tokens":0,"prompt_cache_miss_tokens":5469}
