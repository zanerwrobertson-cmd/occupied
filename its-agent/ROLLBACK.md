# Rollback: stop and remove the agent (under 5 minutes)

The agent changes nothing on the Wi-Fi system, so there's nothing on the network to undo. Removing
it means stopping the schedule, deleting the folder, and disabling the API account.

## 1. Stop it (takes effect immediately)

**systemd:**
```bash
sudo systemctl disable --now occupied-agent.timer
```

**cron:** run `crontab -e` as the `occupied` user and delete the `agent.py` line.

**Windows:**
```powershell
Unregister-ScheduledTask -TaskName "Occupied ITS agent" -Confirm:$false
```

No more data is sent from this moment on.

## 2. Revoke its access

- **Disable or delete the read-only API account/key/token** on the controller (Catalyst Center
  user, Meraki API key, Aruba API client, or Mist token).
- Ask the Occupied team to **revoke the ingest key**, or simply delete it on your side (step 3).

## 3. Remove it

**Linux:**
```bash
sudo rm -f /etc/systemd/system/occupied-agent.service /etc/systemd/system/occupied-agent.timer
sudo systemctl daemon-reload
sudo rm -f /etc/occupied-agent.env          # the secrets
sudo rm -rf /opt/occupied-agent
sudo userdel occupied
```

**Windows:** delete `C:\occupied-agent` and remove the `OCCUPIED_*` environment variables.

## 4. Firewall

Remove the outbound HTTPS rule to the Occupied server.

## What's left behind

Nothing on ITS systems. The agent stores no client data. The only file it ever writes is an
Aruba sign-in token in its own folder, which step 3 deletes. Data already sent (zone totals only)
is held by the Occupied team and can be deleted on request (see PRIVACY.md).
