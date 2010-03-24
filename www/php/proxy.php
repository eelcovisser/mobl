<?php
//          FILE: proxy.php
//
// LAST MODIFIED: 2006-03-23
//
//        AUTHOR: Troy Wolf <troy@troywolf.com>
//
//   DESCRIPTION: Allow scripts to request content they otherwise may not be
//                able to. For example, AJAX (XmlHttpRequest) requests from a
//                client script are only allowed to make requests to the same
//                host that the script is served from. This is to prevent
//                "cross-domain" scripting. With proxy.php, the javascript
//                client can pass the requested URL in and get back the
//                response from the external server. 
//
//         USAGE: "proxy_url" required parameter. For example:
//                http://www.mydomain.com/proxy.php?proxy_url=http://www.yahoo.com
//

// proxy.php requires Troy's class_http. http://www.troywolf.com/articles
// Alter the path according to your environment.
require_once("class_http.php"); 

$proxy_url = isset($_GET['proxy_url'])?$_GET['proxy_url']:false;
//$verb = isset($_GET['verb'])?$_GET['verb']:'GET';
$verb = $_SERVER['REQUEST_METHOD'];
$user = isset($_GET['user'])?$_GET['user']:'';
$pwd = isset($_GET['pwd'])?$_GET['pwd']:'';
if (!$proxy_url) {
    header("HTTP/1.0 400 Bad Request");
    echo "proxy.php failed because proxy_url parameter is missing";
    exit();
}

// Instantiate the http object used to make the web requests.
// More info about this object at www.troywolf.com/articles
if (!$h = new http()) {
    header("HTTP/1.0 501 Script Error");
    echo "proxy.php failed trying to initialize the http object";
    exit();
}

$h->url = $proxy_url;
$h->postvars = $_POST;
//$h->headers = getallheaders();
if (!$h->fetch($h->url, 0, "", $user, $pwd, $verb)) {
    header("HTTP/1.0 501 Script Error");
    echo "proxy.php had an error attempting to query the url";
    echo $h->log;
    exit();
}

// Forward the headers to the client.
$ary_headers = split("\n", $h->header);
foreach($ary_headers as $hdr) { header($hdr); }

// Send the response body to the client.
echo $h->body;
?>
