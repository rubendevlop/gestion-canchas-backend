$bytes = [System.IO.File]::ReadAllBytes("firebase-key.json")
$base64 = [System.Convert]::ToBase64String($bytes)
[System.IO.File]::WriteAllText("firebase-base64.txt", $base64)
