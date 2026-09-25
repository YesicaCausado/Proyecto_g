# Pruebas en vivo de endpoints NeuroLearn AI (auditorÃ­a)
$ErrorActionPreference = "Continue"
$BASE = "http://localhost:8000/api/v1"

function Login($u, $p) {
    $body = @{username = $u; password = $p} | ConvertTo-Json
    try {
        $res = Invoke-RestMethod -Uri "$BASE/auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 20
        return $res.access_token
    } catch {
        Write-Host "  LOGIN FAIL [$u]: $($_.ErrorDetails.Message)"
        return $null
    }
}

function Test-Endpoint($name, $method, $url, $token, $bodyObj = $null) {
    $headers = @{Authorization = "Bearer $token"}
    try {
        if ($bodyObj) {
            $json = $bodyObj | ConvertTo-Json -Depth 6
            $res = Invoke-RestMethod -Uri "$BASE$url" -Method $method -Headers $headers -Body $json -ContentType "application/json" -TimeoutSec 30
        } else {
            $res = Invoke-RestMethod -Uri "$BASE$url" -Method $method -Headers $headers -TimeoutSec 30
        }
        $size = ($res | ConvertTo-Json -Depth 3 -Compress).Length
        Write-Host ("OK   {0,-48} [{1}] size={2}" -f $name, $method, $size)
        return $res
    } catch {
        $code = "?"
        $detail = ""
        try { $code = [int]$_.Exception.Response.StatusCode; $detail = $_.ErrorDetails.Message } catch { $detail = $_.Exception.Message }
        Write-Host ("FAIL {0,-48} [{1}] {2} {3}" -f $name, $method, $code, $detail)
        return $null
    }
}

Write-Host "====== LOGINS ======"
$tStudent = Login "demo" "demo"
$tTeacher = Login "profesor" "profesor"
$tSuper   = Login "superprofesor" "superprofesor"
$tAdmin   = Login "admin" "admin1234"

Write-Host ""
Write-Host "====== ESTUDIANTE (demo) ======"
Test-Endpoint "GET /bots/" "GET" "/bots/" $tStudent | Out-Null
Test-Endpoint "GET /bots/my-bots" "GET" "/bots/my-bots" $tStudent | Out-Null
Test-Endpoint "GET /bots/shared-with-me" "GET" "/bots/shared-with-me" $tStudent | Out-Null
Test-Endpoint "GET /classrooms/my-enrolled" "GET" "/classrooms/my-enrolled" $tStudent | Out-Null
Test-Endpoint "GET /license/my-license" "GET" "/license/my-license" $tStudent | Out-Null
Test-Endpoint "GET /license/check-feature/chat" "GET" "/license/check-feature/chat" $tStudent | Out-Null
Test-Endpoint "GET /chat/stats" "GET" "/chat/stats" $tStudent | Out-Null
Test-Endpoint "GET /chat/quiz-history" "GET" "/chat/quiz-history" $tStudent | Out-Null
Test-Endpoint "GET /chat/patterns" "GET" "/chat/patterns" $tStudent | Out-Null
Test-Endpoint "GET /chat/conversations" "GET" "/chat/conversations" $tStudent | Out-Null
Test-Endpoint "GET /posts" "GET" "/posts" $tStudent | Out-Null
Test-Endpoint "GET /events" "GET" "/events" $tStudent | Out-Null
Test-Endpoint "GET /messages/contacts" "GET" "/messages/contacts" $tStudent | Out-Null
Test-Endpoint "GET /messages/conversations" "GET" "/messages/conversations" $tStudent | Out-Null
Test-Endpoint "GET /notifications" "GET" "/notifications" $tStudent | Out-Null
Test-Endpoint "GET /stats/dashboard" "GET" "/stats/dashboard" $tStudent | Out-Null
Test-Endpoint "GET /stats/performance" "GET" "/stats/performance" $tStudent | Out-Null

Write-Host ""
Write-Host "====== PROFESOR ======"
Test-Endpoint "GET /teacher/stats" "GET" "/teacher/stats" $tTeacher | Out-Null
Test-Endpoint "GET /classrooms/my-classes" "GET" "/classrooms/my-classes" $tTeacher | Out-Null
Test-Endpoint "GET /teacher/evaluations" "GET" "/teacher/evaluations" $tTeacher | Out-Null
Test-Endpoint "GET /teacher/materials" "GET" "/teacher/materials" $tTeacher | Out-Null
Test-Endpoint "GET /license/my-license" "GET" "/license/my-license" $tTeacher | Out-Null
Test-Endpoint "GET /bots/my-bots" "GET" "/bots/my-bots" $tTeacher | Out-Null
Test-Endpoint "GET /notifications" "GET" "/notifications" $tTeacher | Out-Null

Write-Host ""
Write-Host "====== SUPER PROFESOR ======"
Test-Endpoint "GET /super/institution" "GET" "/super/institution" $tSuper | Out-Null
Test-Endpoint "GET /super/stats/dashboard" "GET" "/super/stats/dashboard" $tSuper | Out-Null
Test-Endpoint "GET /super/stats/alerts" "GET" "/super/stats/alerts" $tSuper | Out-Null
Test-Endpoint "GET /super/stats/security" "GET" "/super/stats/security" $tSuper | Out-Null
Test-Endpoint "GET /super/teachers" "GET" "/super/teachers" $tSuper | Out-Null
Test-Endpoint "GET /super/students" "GET" "/super/students" $tSuper | Out-Null
Test-Endpoint "GET /super/license-usage" "GET" "/super/license-usage" $tSuper | Out-Null
Test-Endpoint "GET /super/classrooms" "GET" "/super/classrooms" $tSuper | Out-Null
Test-Endpoint "GET /super/bots" "GET" "/super/bots" $tSuper | Out-Null
Test-Endpoint "GET /super/broadcasts" "GET" "/super/broadcasts" $tSuper | Out-Null
Test-Endpoint "GET /super/audit" "GET" "/super/audit" $tSuper | Out-Null
Test-Endpoint "GET /license/my-license" "GET" "/license/my-license" $tSuper | Out-Null

Write-Host ""
Write-Host "====== ADMIN ======"
Test-Endpoint "GET /admin/users" "GET" "/admin/users" $tAdmin | Out-Null
Test-Endpoint "GET /admin/stats" "GET" "/admin/stats" $tAdmin | Out-Null
Test-Endpoint "GET /admin/institutions" "GET" "/admin/institutions" $tAdmin | Out-Null
Test-Endpoint "GET /admin/audit-logs" "GET" "/admin/audit-logs" $tAdmin | Out-Null
Test-Endpoint "GET /admin/config" "GET" "/admin/config" $tAdmin | Out-Null
Test-Endpoint "GET /admin/bots" "GET" "/admin/bots" $tAdmin | Out-Null
Test-Endpoint "GET /admin/bots/pretrained" "GET" "/admin/bots/pretrained" $tAdmin | Out-Null

Write-Host ""
Write-Host "====== PERMISOS CRUZADOS (deben FALLAR con 403) ======"
Test-Endpoint "X student->GET /teacher/stats" "GET" "/teacher/stats" $tStudent | Out-Null
Test-Endpoint "X student->GET /super/stats/dashboard" "GET" "/super/stats/dashboard" $tStudent | Out-Null
Test-Endpoint "X student->GET /admin/users" "GET" "/admin/users" $tStudent | Out-Null
Test-Endpoint "X student->POST /credentials/admin/institutions" "POST" "/credentials/admin/institutions" $tStudent @{name="X"} | Out-Null
Test-Endpoint "X teacher->GET /super/teachers" "GET" "/super/teachers" $tTeacher | Out-Null
Test-Endpoint "X teacher->GET /admin/users" "GET" "/admin/users" $tTeacher | Out-Null
Test-Endpoint "X super->GET /admin/users" "GET" "/admin/users" $tSuper | Out-Null
Test-Endpoint "X sin token->GET /bots/" "GET" "/bots/" $null | Out-Null

