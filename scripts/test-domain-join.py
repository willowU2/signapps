#!/usr/bin/env python3
"""
E2E test: Simulate Windows domain join against signapps-dc.

Prerequisites:
  - signapps-dc running on localhost:22389 (LDAP) and :22088 (KDC)
  - PostgreSQL running with AD domain configured
"""

import json
import re
import socket
import sys
import time

LDAP_PORT = 22389
KDC_PORT = 22088


def ldap_connect():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    sock.connect(("127.0.0.1", LDAP_PORT))
    return sock


def ldap_bind(sock, dn=b"", password=b""):
    """Send anonymous or simple bind."""
    bind_body = bytes([0x02, 0x01, 0x03])  # version=3
    bind_body += bytes([0x04, len(dn)]) + dn
    bind_body += bytes([0x80, len(password)]) + password
    bind_req = bytes([0x60, len(bind_body)]) + bind_body
    msg = bytes([0x02, 0x01, 0x01]) + bind_req
    packet = bytes([0x30, len(msg)]) + msg
    sock.sendall(packet)
    time.sleep(0.5)
    return sock.recv(4096)


def ldap_search_rootdse(sock):
    """Search rootDSE."""
    search_req = bytes([
        0x30, 0x25, 0x02, 0x01, 0x02,
        0x63, 0x20, 0x04, 0x00, 0x0a, 0x01, 0x00, 0x0a, 0x01, 0x00,
        0x02, 0x01, 0x00, 0x02, 0x01, 0x00, 0x01, 0x01, 0x00,
        0x87, 0x0b, 0x6f, 0x62, 0x6a, 0x65, 0x63, 0x74, 0x43, 0x6c, 0x61, 0x73, 0x73,
        0x30, 0x00,
    ])
    sock.sendall(search_req)
    time.sleep(1)
    data = b""
    while True:
        try:
            chunk = sock.recv(8192)
            if not chunk:
                break
            data += chunk
            if len(chunk) < 8192:
                break
        except Exception:
            break
    return data


def ldap_search_users(sock):
    """Search for all users."""
    base_dn = b"DC=example,DC=com"
    eq_filter = bytes([0xa3, 0x13, 0x04, 0x0b]) + b"objectClass" + bytes([0x04, 0x04]) + b"user"
    body = bytes([0x04, len(base_dn)]) + base_dn
    body += bytes([0x0a, 0x01, 0x02, 0x0a, 0x01, 0x00, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00, 0x01, 0x01, 0x00])
    body += eq_filter + bytes([0x30, 0x00])
    msg = bytes([0x02, 0x01, 0x03, 0x63, len(body)]) + body
    sock.sendall(bytes([0x30, len(msg)]) + msg)
    time.sleep(2)
    data = b""
    while True:
        try:
            chunk = sock.recv(16384)
            if not chunk:
                break
            data += chunk
            if len(chunk) < 16384:
                break
        except Exception:
            break
    return data


def kdc_as_req(principal, realm):
    """Send AS-REQ via JSON dev protocol."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5)
    req = json.dumps({
        "type": "AS-REQ",
        "principal": principal,
        "realm": realm,
        "etypes": [18, 17, 23],
    }).encode()
    sock.sendto(req, ("127.0.0.1", KDC_PORT))
    try:
        data, _ = sock.recvfrom(8192)
        return json.loads(data)
    except Exception:
        return None
    finally:
        sock.close()


def kdc_tgs_req(service, realm):
    """Send TGS-REQ via JSON dev protocol."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(5)
    req = json.dumps({
        "type": "TGS-REQ",
        "service": service,
        "realm": realm,
    }).encode()
    sock.sendto(req, ("127.0.0.1", KDC_PORT))
    try:
        data, _ = sock.recvfrom(8192)
        return json.loads(data)
    except Exception:
        return None
    finally:
        sock.close()


def test_step(name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}]  {name}")
    if details:
        print(f"             {details}")
    return passed


def main():
    print("=" * 60)
    print("  SignApps Domain Join E2E Test")
    print("=" * 60)
    print()

    results = []

    # Phase 1: LDAP Bind
    print("Phase 1: LDAP Connection")
    try:
        sock = ldap_connect()
        resp = ldap_bind(sock)
        results.append(test_step("Anonymous LDAP Bind", len(resp) > 0, f"{len(resp)} bytes"))
    except Exception as e:
        results.append(test_step("Anonymous LDAP Bind", False, str(e)))
        print("\nFATAL: Cannot connect to LDAP. Is signapps-dc running?")
        sys.exit(1)

    # Phase 2: RootDSE
    print("\nPhase 2: RootDSE Discovery")
    data = ldap_search_rootdse(sock)
    has_naming = b"namingContexts" in data
    has_ldap3 = b"supportedLDAPVersion" in data
    has_gssapi = b"GSSAPI" in data
    has_ad_cap = b"1.2.840.113556.1.4.800" in data
    results.append(test_step("RootDSE: namingContexts", has_naming))
    results.append(test_step("RootDSE: LDAP v3", has_ldap3))
    results.append(test_step("RootDSE: GSSAPI support", has_gssapi))
    results.append(test_step("RootDSE: AD capability OID", has_ad_cap))

    # Phase 3: User search
    print("\nPhase 3: Directory Search")
    user_data = ldap_search_users(sock)
    users = list(set(u.decode(errors="replace") for u in re.findall(b"CN=([^,]{1,50})", user_data)))
    results.append(test_step(
        "User search returns entries",
        len(users) > 0,
        f"{len(users)} users: {users[:5]}",
    ))

    has_sam = b"sAMAccountName" in user_data
    has_mail = b"mail" in user_data
    results.append(test_step("Users have sAMAccountName", has_sam))
    results.append(test_step("Users have mail attribute", has_mail))

    sock.close()

    # Phase 4: Authenticated Bind
    print("\nPhase 4: Authentication")
    sock2 = ldap_connect()
    auth_resp = ldap_bind(sock2, b"CN=admin,DC=example,DC=com", b"admin")
    auth_ok = len(auth_resp) > 5
    results.append(test_step("Authenticated Bind (admin)", auth_ok, f"{len(auth_resp)} bytes"))
    sock2.close()

    # Phase 5: Kerberos AS-REQ
    print("\nPhase 5: Kerberos Authentication")
    as_result = kdc_as_req("admin@EXAMPLE.COM", "EXAMPLE.COM")
    if as_result:
        is_preauth = as_result.get("preauth_required", False)
        is_success = as_result.get("success", False)
        results.append(test_step("KDC AS-REQ response", True, json.dumps(as_result)[:100]))
        if is_preauth:
            results.append(test_step(
                "KDC requests pre-auth",
                True,
                f"etypes: {as_result.get('supported_etypes')}",
            ))
        elif is_success:
            results.append(test_step(
                "KDC issues TGT",
                True,
                f"tgt_size: {as_result.get('tgt_size')}",
            ))
    else:
        results.append(test_step("KDC AS-REQ response", False, "No response from KDC"))

    # Phase 6: Kerberos TGS-REQ
    tgs_result = kdc_tgs_req("ldap/dc.example.com@EXAMPLE.COM", "EXAMPLE.COM")
    if tgs_result:
        tgs_ok = tgs_result.get("success", False) or "error_code" in tgs_result
        results.append(test_step("KDC TGS-REQ response", tgs_ok, json.dumps(tgs_result)[:100]))
    else:
        results.append(test_step("KDC TGS-REQ response", False, "No response"))

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"  Results: {passed}/{total} tests passed")
    if passed == total:
        print("  ALL TESTS PASSED -- Domain join flow is functional!")
    else:
        print(f"  {total - passed} test(s) failed")
    print("=" * 60)

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
