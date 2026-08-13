# Encoding Rules

## UTF-8 Requirement

Any request body that contains text fields must be handled explicitly as UTF-8.

This rule applies to:
- Text provided directly by the user
- Text read from files
- Text fetched from webpages or external content
- Text composed through variables before sending a request

Do not assume text is already valid UTF-8.

## PowerShell 5.1 Rules

PowerShell 5.1 may silently re-encode request bodies to the system ANSI code page. Whenever an API request with a JSON body is sent from PowerShell 5.1, convert the JSON string to UTF-8 bytes before sending it.

```powershell
$body = @{ title = "Title"; content = $content } | ConvertTo-Json -Depth 10
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-RestMethod -Uri $url -Method Post -Body $utf8Bytes -ContentType "application/json; charset=utf-8" -Headers $headers
```
