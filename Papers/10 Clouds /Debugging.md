Debugging the Membrane Directory Rendering
Issue
Overview of the Problem
The Membrane Directory panel is supposed to list all available sub-membranes (panels) inside the sidebar
shell. In the current “Donut of Attention” UI, this directory panel is visible (the shell opens in overlay mode
on startup), but its list content is empty. We need to determine why the list of sub-membranes isn’t
rendering, and fix the shell toggle behavior and docking persistence.
Key Findings
After comparing the latest code with older behavior, we identified several issues:
1.
2.
3.
4.
Mismatch in List Container Class/ID: The HTML markup and JS code disagree on the list element’s
class, causing duplicate elements and an empty list in the UI.
Incorrect Initialization of Sidebar Toggle State: The 3-state shell toggle (Hidden → Overlay →
Docked) isn’t synced with the actual initial mode, requiring an extra click to cycle states.
Override of Persisted Shell Mode: On startup the code always forces “Overlay” mode, ignoring a
saved “Docked” state (pinned) and potentially re-hiding a previously hidden shell.
Legacy Docking Code Removed: All panels (except the Membrane Directory itself) now open in
floating mode by default, as intended. We must ensure fixes don’t reintroduce old ghost/docking
behaviors.
Below we detail each issue and the recommended fixes.
1. Membrane Directory List Not Populating
Cause: The Membrane Directory panel’s list container is not being recognized by the JS initialization logic
due to a class name mismatch. In index.html , the list is a <div> with class
1
"membrane-directory" and id "membraneDirectoryList" . However, the script looks for an
element with class .membrane-directory__list when attaching the panel to the shell. Because it
doesn’t find one, it creates a new list element dynamically 2
. This results in two elements with the same
id ( membraneDirectoryList ) inside the panel – the original (with class .membrane-directory ) and
an empty one (with class .membrane-directory__list ). The code then populates the original element
with the sub-membrane items, but the duplicate ID and element may confuse the rendering.
Evidence: In attachMembraneDirectoryToShell() , the code checks:
1
if (!membraneDirectoryPanel.querySelector('.membrane-directory__list')) {
// ... create a new list div
list.className = 'membrane-directory__list';
list.id = 'membraneDirectoryList';
membraneDirectoryPanel.appendChild(list);
}
2
. Meanwhile, the HTML already has a #membraneDirectoryList div (class
"membrane-directory" ) inside the panel 1
. This discrepancy causes the duplicate element insertion.
Result: The Membrane Directory content is actually being rendered, but likely into the original
.membrane-directory div, which might not be the one the UI is effectively showing due to the DOM
confusion. The dev journal noted this as well: after making the shell visible by default, the directory content
3 4
was still empty and needed a “debug render” check .
Fix: Align the HTML and JS expectations for the list container. The simplest fix is to change the HTML to
use the expected class name. In index.html , update the Membrane Directory list div to:
<div class="membrane-directory__list" id="membraneDirectoryList"></div>
instead of class="membrane-directory" . This way, attachMembraneDirectoryToShell() will find
the element and not create a duplicate 2
. With a single, correctly identified list container
( membraneDirectoryList ), the renderMembraneDirectory() function can fill it with the sub-
membrane <div class="membrane-directory__item">…</div> entries, and they will be visible.
We verified that no CSS is intentionally hiding the list: the .membrane-directory class is styled as a flex
5
column for list items , and .membrane-directory__block--list (the parent wrapper) has a
scrollable max-height 6
. So once the DOM issue is resolved, the list should render normally.
2. Default Panel Mode – Floating Panels by Design
It’s confirmed that the new UI is designed for floating panels by default, with the shell being an optional
container. All sub-membrane panels (e.g. Everything Chalice, SolarOS Hologram, etc.) remain in the
#floatingLayer and are hidden ( is-hidden ) initially. When opened via the directory, they simply
become visible and free-floating – no docking unless the user explicitly pins them.
Evidence: The “Open” action in the directory uses showMembrane(panelId) 7
. This function just
removes the is-hidden attribute and brings the panel to front 8
; it does not attach the panel to any
sidebar container. The dev journal confirms legacy docking was stripped out: ghost sidebars and dock
controllers are disabled in the code 9
. Thus, the default behavior is indeed that panels open as
independent floating windows, which meets the requirement for float mode by default.
Conclusion: No changes needed here beyond ensuring the directory itself renders (from point 1) and that
we don’t accidentally revert to old docking logic. The code already avoids adding any panel--docked
2
classes or ghost sidebar usage, and CSS for those legacy modes has been largely purged (entry #082) – e.g.,
9
ensureRightSidebarPanels() and updateGhostVisibility() are no-ops . We will maintain
this floating panel behavior.
3. Three-State Sidebar Toggle Logic
The sidebar shell’s toggle button ( #sidebarShellToggle ) should cycle through Hidden → Overlay →
Docked modes. Currently, there’s a minor logic bug causing the first click to appear non-functional:
Issue: The sidebarModeIndex is not initialized to match the current mode. In code,
10
PIN_SIDEBAR_MODES = ['hidden','overlay','docked'] , and sidebarModeIndex starts at 0.
On startup, the shell is set to overlay mode, but sidebarModeIndex remains 0 (which corresponds to
“hidden”). Thus, when the user clicks the toggle the first time, the code does sidebarModeIndex =
(0+1)%3 = 1 and tries to set mode to PIN_SIDEBAR_MODES[1] which is “overlay” 11 12
. In effect, it
toggles from Overlay to Overlay again, causing no visible change (the button still says "Overlay", shell stays
overlay). The next clicks then cycle to Docked and Hidden as expected.
Fix: Synchronize the index with the actual initial state. After determining the startup mode, set
sidebarModeIndex accordingly (overlay = 1, docked = 2, hidden = 0). For example, right after calling
setSidebarMode() during initialization, add:
sidebarModeIndex = PIN_SIDEBAR_MODES.indexOf(state.ui.shellMode);
This ensures the toggle button’s internal index matches the displayed state. Then the first click will correctly
switch to Docked (if starting in Overlay), and so on.
Alternatively, the setSidebarMode() class toggling and button text 11
toggle will truly become a seamless 3-state cycle.
function itself could update the index, but it currently only handles
. A one-time fix after initialization is sufficient. With this change, the
4. Preserving Docked (Pinned) State on Startup
When the Membrane Directory is “pinned” (docked in the sidebar), it should remain open and docked on
page reload. The current code logic intends to persist this via state.ui.shellMode . However, a hard-
coded override is resetting the mode to overlay every time the app starts:
Issue: After attaching the Membrane Directory panel to the shell, the code explicitly calls
13
setSidebarMode('overlay') regardless of the saved state . This means even if
state.ui.shellMode === 'docked' from a previous session, the shell will still come up in overlay
mode on the next load. Essentially, the user’s preference to pin the directory is not honored on startup.
(Likewise, if the user last hid the shell, that is ignored and it shows anyway.)
Fix: Don’t force-reset the shell mode on load. We should remove or conditionalize the line that sets the
13
sidebar mode to 'overlay' by default . The attachMembraneDirectoryToShell() function already
3
applies the saved mode: it calls setSidebarMode(state.ui.shellMode || 'overlay') as part of
14
attaching . Therefore, the extra setSidebarMode('overlay') is redundant and harmful. Removing
this ensures that if the user last pinned the directory ( shellMode === 'docked' ), the sidebar will stay
docked (CSS class is-docked applied, panel on left side) on the next launch.
After this change, pinned mode persists as expected – the Membrane Directory will remain in the sidebar
and visible by default when docked, satisfying objective (4). The state persistence for shellMode was
already in place (see state.ui.shellMode being saved, with default set to 'overlay' if none 15
), so we’re
now properly using it.
Note: If the user last closed/hidden the shell ( shellMode === 'hidden' ), removing the override means
the shell would actually start hidden. This is logically consistent with persistence, but we should ensure
there’s a way to reopen it (e.g. a keyboard shortcut or some icon). The design mentions Esc to close and
possibly Ctrl/Cmd+K to open search (which would show the shell) 16
. Assuming that’s in place or planned,
honoring the 'hidden' state is fine. Otherwise, we might default to overlay on a fresh load to avoid a “locked
out” hidden panel scenario. This detail can be decided based on UX considerations, but the code should at
least not override a docked state – which was the primary concern.
5. Verification After Changes
With the fixes above, the Membrane Directory should function correctly:
•
•
•
•
Directory List Renders: The list of sub-membranes populates inside the shell overlay on startup,
showing all non-fixed membrane panels (e.g. Crown, Everything Chalice, etc.) as rows. This confirms
the class/ID mismatch was resolved, and renderMembraneDirectory() successfully injects the
content (it filters out only the directory itself and any data-membrane-fixed="true" panels like
the Entry Door 17 18 19
). The “Membranes available” count will also update accordingly .
Default Mode is Float: Panels open via the directory appear as floating windows by default. No
unintended docking occurs. For example, clicking “Open” in the directory on a panel will call
showMembrane() which simply unhides the panel in the floating layer 7 8
. The panel gets a
standard toolbar (Pin/Focus/Collapse/Close) from ensurePanelChrome() 20 21
, consistent with
the new system design.
Toggle Cycles Correctly: The sidebar toggle button now reflects and controls the 3 states in order. If
the shell starts in Overlay (the default), one click will switch to Docked (sidebar moves to left, button
text becomes “Docked”), the next click will Hide the shell (button text “Hidden”, sidebar closed), and
another click brings it back to overlay. This is achieved by the index sync fix and no other logic
change (the underlying CSS classes .is-overlay, .is-docked , .is-hidden already work as
22
shown in light.css ).
Pinned State Preserved: If the user pins the Membrane Directory (switching to docked mode) and
reloads, the app will come up with the directory still docked on the side. The code respects
state.ui.shellMode = 'docked' on startup now that we don’t always force overlay. The
directory panel remains open and populated in the docked sidebar. (If the user hides the shell, it will
remain hidden on reload – as noted, this behavior is okay as long as the user can toggle it back open
via some control).
Throughout these changes, we avoided re-introducing any legacy “ghost” sidebar code. We only
modified the new sidebarShell logic. The old #sidebar / #sidebarRight CSS rules in light.css
4
are obsolete (no element with those IDs exists now), and we did not restore any of the removed docking
mechanics. The floating-layer and new Circle/Desk collapse features remain intact (e.g. pinning a panel puts
a circle chip in the center, collapsing to desk puts an icon in the desk bar, etc., and the directory reflects
those statuses in the “Pinned” or “Collapsed” labels 23
).
By fixing the identified bugs, the Membrane Directory will reliably serve as the hub for navigating sub-
membranes in all shell modes, exactly as intended in the updated design.
Sources:
•
Donut UI latest code ( app.js, index.html , light.css ) – analysis of
attachMembraneDirectoryToShell and render logic for shell and directory.
• 3 26
Dev Journal entries – confirmation of recent changes to shell behavior 27
docking .
24 25 1
, HTML structure , and CSS rules
and removal of legacy
1
index.html
file://file_00000000878c720aab7c659f2016c9f6
2 7 8 9 10 11 12 13 14 15 17 18 19 20 21 23 24 25
app.js
file://file_00000000b5dc720a9d1f9e18ec713e79
3 4 26 27
dev_journal.md
file://file_000000007428720aa7e5543b99cdfe93
5 6 22
light.css
file://file_000000007f40720a860b27660a740a7e
16
PLANS.md
file://file_000000000ee0720a9ca1142c510ead83
5