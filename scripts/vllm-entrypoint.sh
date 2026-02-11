#!/bin/bash
# vLLM auto-selection entrypoint
# Detects GPU VRAM and selects the best model automatically.
# All models are public (no HuggingFace token required).

set -e

VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)

if [ -z "$VRAM_MB" ]; then
    echo "ERREUR: impossible de detecter la VRAM GPU (nvidia-smi indisponible)."
    exit 1
fi

# Tiers de modeles (tous publics, pas de HF token requis)
if [ "$VRAM_MB" -ge 16000 ]; then
    # 16GB+ : Phi-3 Mini en half precision (meilleure qualite/taille)
    MODEL="microsoft/Phi-3-mini-4k-instruct"
    EXTRA_ARGS="--dtype half --max-model-len 4096 --gpu-memory-utilization 0.85"
elif [ "$VRAM_MB" -ge 8000 ]; then
    # 8-16GB : Mistral 7B quantifie AWQ (excellent rapport qualite/VRAM)
    MODEL="TheBloke/Mistral-7B-Instruct-v0.2-AWQ"
    EXTRA_ARGS="--quantization awq --max-model-len 4096 --gpu-memory-utilization 0.85"
elif [ "$VRAM_MB" -ge 6000 ]; then
    # 6-8GB : Mistral 7B AWQ contexte reduit
    MODEL="TheBloke/Mistral-7B-Instruct-v0.2-AWQ"
    EXTRA_ARGS="--quantization awq --max-model-len 2048 --gpu-memory-utilization 0.90"
else
    echo "ERREUR: VRAM insuffisante (${VRAM_MB}MB). Minimum 6GB requis."
    exit 1
fi

echo "=== vLLM Auto-Config ==="
echo "GPU VRAM: ${VRAM_MB}MB"
echo "Modele selectionne: ${MODEL}"
echo "========================"

exec python3 -m vllm.entrypoints.openai.api_server \
    --model "${MODEL}" \
    --host 0.0.0.0 \
    --port 8000 \
    --enforce-eager \
    ${EXTRA_ARGS}
