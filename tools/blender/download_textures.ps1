$ErrorActionPreference = 'Stop'
# Powered by Poly Haven. Public CC0 assets, fetched once for offline packaging.
$destination = Join-Path $PSScriptRoot '../../models/csgo/textures'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$records = @()
foreach ($assetId in @('plastered_stone_wall','plastered_wall_02','sandy_gravel','cobblestone_floor_02','weathered_brown_planks','sandstone_blocks_04')) {
  $files = Invoke-RestMethod -Uri ('https://api.polyhaven.com/files/' + $assetId) -Headers @{ 'User-Agent' = 'SupportHub-graphics/1.0' }
  foreach ($channel in @('Diffuse','nor_gl','Rough')) {
    $file = $files.$channel.'1k'.jpg
    if (-not $file.url) { throw "Missing 1K texture: $assetId $channel" }
    $name = $assetId + '_' + $channel + '.jpg'
    $target = Join-Path $destination $name
    if (-not (Test-Path -LiteralPath $target)) { Invoke-WebRequest -Uri $file.url -OutFile $target }
    if ((Get-FileHash -LiteralPath $target -Algorithm MD5).Hash.ToLower() -ne $file.md5) { throw "Checksum mismatch: $name" }
    $records += @{ file=$name; asset=$assetId; channel=$channel; source=$file.url; md5=$file.md5; license='CC0-1.0' }
  }
}
$records | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $destination 'sources.json') -Encoding utf8
Write-Output ('Downloaded and verified ' + $records.Count + ' CC0 texture maps.')
