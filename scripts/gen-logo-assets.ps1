# Generates all app icon / PWA assets from logo/logo.png
# Crops the circular emblem for square icons; uses the full logo for the splash.
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root   = "D:\Playground\jewellery-bill-book"
$src    = Join-Path $root "logo\logo.png"
$assets = Join-Path $root "assets"
$pub    = Join-Path $root "public"
$pubIco = Join-Path $pub "icons"
New-Item -ItemType Directory -Force -Path $pubIco | Out-Null

$logo = [System.Drawing.Bitmap]::FromFile($src)
$W = $logo.Width; $H = $logo.Height

# Background (cream) sampled from a corner.
$bg = $logo.GetPixel(2,2)
$cream = [System.Drawing.Color]::FromArgb(255, $bg.R, $bg.G, $bg.B)

# ---- find emblem bounding box (dark pixels in the top ~52% of the image) ----
$rect = New-Object System.Drawing.Rectangle 0,0,$W,$H
$data = $logo.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride*$H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$logo.UnlockBits($data)

$yMax = [int]($H*0.52)
$minX=$W; $minY=$H; $maxX=0; $maxY=0
for($y=0; $y -lt $yMax; $y++){
  $rowOff = $y*$stride
  for($x=0; $x -lt $W; $x++){
    $i = $rowOff + $x*4
    $lum = 0.299*$bytes[$i+2] + 0.587*$bytes[$i+1] + 0.114*$bytes[$i]
    if($lum -lt 140){
      if($x -lt $minX){$minX=$x}; if($x -gt $maxX){$maxX=$x}
      if($y -lt $minY){$minY=$y}; if($y -gt $maxY){$maxY=$y}
    }
  }
}
$bw = $maxX-$minX; $bh = $maxY-$minY
Write-Host "bg = $($bg.R),$($bg.G),$($bg.B)   emblem bbox = $minX,$minY .. $maxX,$maxY  (w=$bw h=$bh)"

# ---- helper: build a square cream bitmap containing the emblem ----
# padFactor = how much of the square the emblem occupies (1.0 = tight, lower = more margin)
function New-EmblemSquare([double]$fill, [bool]$transparentBg) {
  $emblem = [Math]::Max($bw,$bh)
  $side   = [int]([Math]::Round($emblem / $fill))
  $cx = $minX + $bw/2.0
  $cy = $minY + $bh/2.0
  $srcX = $cx - $side/2.0
  $srcY = $cy - $side/2.0
  $sq = New-Object System.Drawing.Bitmap($side,$side)
  $g = [System.Drawing.Graphics]::FromImage($sq)
  if($transparentBg){ $g.Clear([System.Drawing.Color]::Transparent) } else { $g.Clear($cream) }
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($logo, [int](-$srcX), [int](-$srcY), $W, $H)
  $g.Dispose()
  return $sq
}

# ---- helper: resize a bitmap to NxN (or WxH) onto an optional cream/transparent canvas ----
function Save-Resized([System.Drawing.Bitmap]$bmp, [int]$w, [int]$h, [string]$path, [bool]$transparentBg) {
  $out = New-Object System.Drawing.Bitmap($w,$h)
  $g = [System.Drawing.Graphics]::FromImage($out)
  if($transparentBg){ $g.Clear([System.Drawing.Color]::Transparent) } else { $g.Clear($cream) }
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($bmp, 0, 0, $w, $h)
  $g.Dispose()
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  Write-Host "  wrote $path  ($w x $h)"
}

# ---- helper: full logo letterboxed onto a square cream canvas (for splash) ----
function New-FullLogoSquare([int]$side, [double]$scale) {
  $sq = New-Object System.Drawing.Bitmap($side,$side)
  $g = [System.Drawing.Graphics]::FromImage($sq)
  $g.Clear($cream)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $target = $side*$scale
  $ratio = [Math]::Min($target/$W, $target/$H)
  $dw = $W*$ratio; $dh = $H*$ratio
  $g.DrawImage($logo, [int](($side-$dw)/2), [int](($side-$dh)/2), [int]$dw, [int]$dh)
  $g.Dispose()
  return $sq
}

# Tight emblem (square icons), padded emblem (adaptive / maskable safe zone)
$emblemTight = New-EmblemSquare 0.86 $false
$emblemPad   = New-EmblemSquare 0.62 $false       # more margin for Android adaptive + maskable
$emblemFgT   = New-EmblemSquare 0.62 $true        # transparent bg for Android foreground
$emblemMark  = New-EmblemSquare 0.94 $true        # transparent, tight — in-app logo mark

Write-Host "== app assets =="
Save-Resized $emblemTight 1024 1024 (Join-Path $assets "icon.png") $false
Save-Resized $emblemFgT    512  512 (Join-Path $assets "android-icon-foreground.png") $true
Save-Resized $emblemMark   512  512 (Join-Path $assets "logo-mark.png") $true
Save-Resized $emblemTight   48   48 (Join-Path $assets "favicon.png") $false

# adaptive background = solid cream
$bgOut = New-Object System.Drawing.Bitmap(512,512)
$gb = [System.Drawing.Graphics]::FromImage($bgOut); $gb.Clear($cream); $gb.Dispose()
$bgOut.Save((Join-Path $assets "android-icon-background.png"), [System.Drawing.Imaging.ImageFormat]::Png); $bgOut.Dispose()
Write-Host "  wrote android-icon-background.png (512 x 512, solid cream)"

# splash = full logo centered on cream
$splash = New-FullLogoSquare 1024 0.72
$splash.Save((Join-Path $assets "splash-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
Save-Resized $splash 256 256 (Join-Path $root "logo\_preview_splash.png") $false
$splash.Dispose()
Write-Host "  wrote splash-icon.png (1024 x 1024, full logo)"

Write-Host "== PWA / iOS icons (public/icons) =="
Save-Resized $emblemTight 192 192 (Join-Path $pubIco "icon-192.png") $false
Save-Resized $emblemTight 512 512 (Join-Path $pubIco "icon-512.png") $false
Save-Resized $emblemPad   512 512 (Join-Path $pubIco "maskable-512.png") $false
Save-Resized $emblemTight 180 180 (Join-Path $pubIco "apple-touch-icon.png") $false
Save-Resized $emblemTight 167 167 (Join-Path $pubIco "apple-touch-icon-167.png") $false
Save-Resized $emblemTight 152 152 (Join-Path $pubIco "apple-touch-icon-152.png") $false
Save-Resized $emblemTight 120 120 (Join-Path $pubIco "apple-touch-icon-120.png") $false
# favicon for web root
Save-Resized $emblemTight 196 196 (Join-Path $pub "favicon.png") $false

# preview for verification
Save-Resized $emblemTight 256 256 (Join-Path $root "logo\_preview_emblem.png") $false
Save-Resized $emblemPad 256 256 (Join-Path $root "logo\_preview_maskable.png") $false

$emblemTight.Dispose(); $emblemPad.Dispose(); $emblemFgT.Dispose(); $emblemMark.Dispose()
$logo.Dispose()
Write-Host "DONE"
