# PXE Operational Debug Skill

Use this skill when the user asks about PXE DHCP/TFTP flow failures,
wizard issues, live stream problems, auto-discovery not picking up
machines, or enrollment pipeline bugs.

## Quick diagnosis flow

1. **Check listener status** — look for these log lines at boot:
   - `TFTP UDP :6969 listener enabled`
   - `ProxyDHCP listener enabled on :4011 (auto_enroll=true)`
   If absent or port-bind failure, inspect `PXE_MODE`, `PXE_ENABLE_TFTP`,
   `PXE_ENABLE_PROXY_DHCP` env vars.

2. **Test from sim** — the bundled simulator sends a DHCPDISCOVER and
   prints the OFFER:
   ```bash
   cargo run -p signapps-pxe --bin signapps-pxe-sim
   ```
   Expected output includes TFTP server IP and boot file.

3. **Check DHCP audit log** — recent requests are exposed via
   `GET /api/v1/pxe/dhcp/recent?limit=50`. Look for `responded=false`
   rows (vendor class rejected or option 60 missing).

4. **Check SSE pipeline** — subscribe manually:
   ```bash
   curl -N -H "Cookie: <session>" \
     http://localhost:3099/api/v1/pxe/deployments/<mac>/stream
   ```
   Then trigger a progress update:
   ```sql
   UPDATE pxe.deployments SET progress = 42 WHERE asset_mac = '<mac>';
   ```
   A `data: {...}` line should appear within 100 ms.

5. **Check trigger + NOTIFY channel**:
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgname = 'pxe_deployment_progress_notify';
   LISTEN pxe_deployment_progress;  -- in psql
   ```

## Common issues

| Symptom                     | Root cause                                    | Fix                                             |
|-----------------------------|-----------------------------------------------|-------------------------------------------------|
| TFTP bind fails             | `PXE_MODE=root` but no privileges              | Use `PXE_MODE=user` (defaults 6969)             |
| ProxyDHCP no response       | MAC missing option 60 `PXEClient`              | Verify DHCPDISCOVER carries `PXEClient:Arch:…`  |
| SSE stays idle              | Reverse proxy buffering body                   | Add `X-Accel-Buffering: no` header upstream     |
| Wizard stuck on step 1      | `/pxe/catalog` returns 401                     | Check auth cookie/token; re-login as admin      |
| Assets not appearing        | `PXE_AUTO_ENROLL=false`                        | Set to `true` or `POST /assets/:mac/enroll`     |
| `/_test/simulate-dhcp` 404  | Running a release build                        | Rebuild in debug or seed DHCP log manually      |
| SSE event filter drops all  | NOTIFY payload uses `"key" : "val"` w/ spaces  | Filter on raw MAC value only (never full key:val) |

## Relevant files

- `services/signapps-pxe/src/sse.rs` — SSE endpoint + subscribe helper
- `services/signapps-pxe/src/auto_enroll.rs` — DHCP audit + MAC upsert
- `services/signapps-pxe/src/handlers.rs` — REST handlers, test sim endpoint
- `services/signapps-pxe/src/dhcp_proxy.rs` — ProxyDHCP listener
- `services/signapps-pxe/src/tftp.rs` — TFTP listener
- `migrations/427_pxe_autodiscovery_sse.sql` — trigger + NOTIFY function
- `client/src/app/pxe/wizard/page.tsx` — 5-step wizard container
- `client/src/hooks/usePxeDeploymentStream.ts` — EventSource hook
- `client/e2e/s2-pxe.spec.ts` — E2E scenarios
