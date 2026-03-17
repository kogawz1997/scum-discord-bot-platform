param()

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) {
  @{
    ok = $false
    code = 'DELIVERY_NATIVE_PROOF_EMPTY_INPUT'
    proofType = 'inventory-state'
    detail = 'No verification payload was provided.'
  } | ConvertTo-Json -Compress
  exit 1
}

try {
  $payload = $raw | ConvertFrom-Json -Depth 20
} catch {
  @{
    ok = $false
    code = 'DELIVERY_NATIVE_PROOF_BAD_JSON'
    proofType = 'inventory-state'
    detail = 'Input payload is not valid JSON.'
  } | ConvertTo-Json -Compress
  exit 1
}

$purchaseCode = [string]$payload.purchaseCode
$steamId = [string]$payload.steamId
$items = @($payload.expectedItems)

# Replace this section with real inventory inspection.
# Expected output contract:
# - ok: true/false
# - proofType: short backend name
# - detail: human-readable summary
# - warnings: optional string array
# - evidence: optional object with raw proof data
$result = @{
  ok = $false
  code = 'DELIVERY_NATIVE_PROOF_NOT_IMPLEMENTED'
  proofType = 'inventory-state'
  detail = 'Template script is present but game inventory inspection is not implemented yet.'
  warnings = @(
    'Wire this script to your game-side inventory/state source before enabling required mode.'
  )
  evidence = @{
    purchaseCode = $purchaseCode
    steamId = $steamId
    expectedItems = $items
    observedItems = @()
  }
}

$result | ConvertTo-Json -Depth 20 -Compress
