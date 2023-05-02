<?php
$bottoken = "";

$ch = curl_init();
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    'Authorization: Basic ' . $bottoken,
    'Accept: application/json',
    'Content-Type: application/x-www-form-urlencoded'
));

curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_URL, "https://accounts.spotify.com/api/token");
echo curl_exec($ch);
curl_close($ch);
die();
?>
