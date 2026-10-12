# Questions for Western ITS

What we need to turn this from "tested with sample data" into a live feed. Most are quick answers.

## The Wi-Fi system

1. **Which wireless platform runs the main campus?** Cisco Catalyst Center (DNA Center), Cisco
   Meraki, Aruba Central, Juniper Mist, or something else?
   - If something else (e.g. a Cisco 9800 controller without Catalyst Center, Aruba Mobility
     Conductor, or Extreme), we'll write a connector for it. It's about 50 lines.
2. **Which version?** For example Catalyst Center 2.3.7, or Aruba Central classic vs new Central.
3. **Is the API enabled, and can you create a read-only account for it?** (Catalyst Center
   OBSERVER role, Meraki read-only API key, Aruba read-only API client, or Mist Observer token.)
4. **If Catalyst Center or Aruba Central:** are you OK with the one sign-in POST these platforms
   require to issue a session token? Every other request is a GET, enforced in code.
5. **Would you rather not give API access at all?** The agent can instead read a CSV export
   (`ap_name,count`) that your own tools produce on a schedule.

## Access points and zones

6. **A list of access point names with their building and floor**, or whatever naming convention
   lets us work it out. We'll draft `zones.csv`, and ITS reviews it.
7. **Which buildings are residences?** They're excluded automatically, but we'd like the
   official list rather than our guess.
8. **Any other areas that should never be counted** (e.g. health services, counselling,
   staff-only spaces)? Those APs get `exclude = yes`.
9. **Do the AP names contain anything sensitive?** They never leave your network either way,
   but it's worth knowing.

## Running it

10. **Which server could run it**, and which OS? It needs Python 3.11+ and nothing else.
11. **Which scheduler do you prefer?** systemd timer, cron, or Windows Task Scheduler. All
    three are covered in SETUP.md.
12. **Firewall:** can that server make one outbound HTTPS (443) connection to our server, and
    reach the controller API?
13. **Does the controller use a certificate from an internal CA?** If so, we need the CA file
    path for `ca_file`.
14. **Is every 15 minutes OK?** Each run is a few read requests (one per page of APs).

## Policy

15. **Who needs to approve this** (security review, privacy office, or data governance), and is
    there a form or process?
16. **Is a threshold of 10 enough**, or do you want a higher one? It can only be raised.
17. **How long may we keep zone totals?** We propose 8 weeks, then automatic deletion.
18. **Who should we contact** if the feed stops or something looks wrong?
