"""Waits for a TestFlight build to finish processing, then adds it to a beta group.
Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8, BUNDLE_ID, BUILD_NUMBER, GROUP_NAME."""
import json, os, sys, time, urllib.request, urllib.error
import jwt

API = 'https://api.appstoreconnect.apple.com/v1'

def token():
    now = int(time.time())
    return jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
                      os.environ['ASC_KEY_P8'], algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'})

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        print(method, path, e.code, e.read().decode()[:800]); raise

app = call('GET', f"/apps?filter[bundleId]={os.environ['BUNDLE_ID']}")['data'][0]['id']
number = os.environ['BUILD_NUMBER']
build = None
for _ in range(80):  # up to ~40 minutes
    data = call('GET', f'/builds?filter[app]={app}&filter[version]={number}&limit=1')['data']
    if data:
        state = data[0]['attributes']['processingState']
        print('build', number, state)
        if state == 'VALID':
            build = data[0]['id']; break
        if state in ('FAILED', 'INVALID'):
            sys.exit(f'build {number} is {state}')
    else:
        print('build', number, 'not visible yet')
    time.sleep(30)
if not build:
    sys.exit('timed out waiting for processing')

groups = call('GET', f'/apps/{app}/betaGroups?limit=50')['data']
group = next((g for g in groups if g['attributes']['name'] == os.environ['GROUP_NAME']), None)
if not group:
    sys.exit('beta group not found: ' + os.environ['GROUP_NAME'])
print('group', json.dumps(group['attributes']))
if group['attributes'].get('hasAccessToAllBuilds'):
    print(f"group {os.environ['GROUP_NAME']} already gets every build: build {number} is available to its testers")
    sys.exit(0)
call('POST', f"/betaGroups/{group['id']}/relationships/builds", {'data': [{'type': 'builds', 'id': build}]})
print(f"build {number} added to group {os.environ['GROUP_NAME']}")
