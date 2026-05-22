# PAI: Back to the Future

I've been running Daniel Miessler's PAI v4 for a while now, and I want to start with the
part that matters most: I'm grateful. I chose PAI deliberately, and for good reasons —
Daniel's principles, his genuine engineering and security background, the respect he's
earned in the community, and the design ideas that make PAI more than a pile of prompts.
The Algorithm gives work a real shape. The Skills are thoughtful and inclusive. The whole
thing is extensible in a way that invites you to build on it. And Daniel has done all of
this without monetising it, which I don't take for granted. PAI articulated a
human-centric vision for personal AI before the current wave of agent harnesses crested,
and for a long time it felt like the "pro" option even where it lacked autonomous agency.

So this isn't a takedown. It's a worried letter from someone who wants PAI to win.

## Where it grinds

My frustrations are real, though, and they've been accumulating.

The biggest is the development model. PAI is MIT-licensed, but development is effectively
closed: the public repo is, by Daniel's own description, a *sanitized instance* of his
private infrastructure, and changes are hand-ported from the internal repo out to the
public one before each release. You can file issues, open PRs, and start discussions — but
they don't flow back through a normal public pipeline. This has been executed unevenly,
and a promised move to a more conventional open process hasn't arrived. The result is that
the community can knock on the door but can't really come in and help.

The second is PAI's entanglement with Claude Code. This is genuinely double-edged. PAI is
excellent *because* it leans into Claude Code's services and configuration — but that
intimacy blurs the line between what's PAI and what's Claude Code, and that makes problems
hard to debug. Small example: the skill and command names aren't branded, so `/council`
or `/first-principles` sit directly in the shared namespace where I'd rather see
`/pai-thinking`. Larger example: PAI reaches deep into `settings.json`, hooks, protected
folders, voice, and the status line. Some of that may be a hard requirement — but it's
never clear which parts are essential and which are just convenient.

The third is the lack of granular configuration. I want simple switches: voice on/off, a
simpler status line, the Algorithm on/off, even PAI itself on/off. Today those are
all-or-nothing, which pushes me toward local edits — and every local edit makes the next
upgrade harder, because I'm cherry-picking and re-applying my own changes against a new
drop instead of pulling cleanly.

## Standing back

When I step back, the pattern worries me more than any single issue. PAI depends heavily
on one person. Daniel almost certainly has other demands on his time, and that's
completely fair — but a sole architect with limited hours, plus a hand-cranked release
method, is fragile. I think you can see the cracks: community engagement has cooled, fixes
land slowly, and recent releases have felt rougher.

Meanwhile, the ground is moving. Claude Code is evolving fast, and some of its new features
now overlap or even collide with what PAI provides — keeping the two in sync could be a
full-time job on its own. It's also worth asking, honestly, whether frontier models still
need a heavyweight harness to behave well. My own suspicion is that a clean Claude Code
install on something like Opus 4.7 may already be closing the gap. And the alternatives
have matured astonishingly quickly: OpenClaw and Hermes Agent both arrived recently and
have surged ahead on autonomous agency, UI options, popularity, and ecosystem — areas
where PAI now trails.

I'll be honest: that leaves me genuinely sad. With PAI 5.0 — the "Life Operating System" —
already out, the decision in front of me isn't hypothetical. And rather than fight through
another big upgrade, I'm tempted to install and evaluate OpenClaw or Hermes Agent instead,
and then cherry-pick the PAI ideas I love into whichever one I land on. I don't *want* to
do that. But I can feel the pull.

## Back to the future

Here's where I get optimistic, because I don't think PAI's best days are behind it — I
think they're behind the wrong architecture. Daniel originally composed PAI out of
separate projects. I think the way forward is to go back to that unbundled spirit:
feature-level installs that drop cleanly into a wide range of harnesses — Claude Code,
Codex, OpenCode, Crush, OpenClaw, Hermes Agent, whatever comes next. This isn't a fantasy;
the community has already shown it works by porting PAI to OpenCode. PAI's real value is
its philosophy and its features, not its binding to one runtime.

The second half is the development model. PAI should adopt an open process that genuinely
welcomes community contributions to accelerate major, minor, and patch releases — while
Daniel keeps firm hold of what only he should hold: the conceptual design, the
architecture, the roadmap, and the final say on what gets in. Lead the vision; let the
community carry more of the load.

PAI shouldn't die a slow death, withering on the vine. To avoid that it has to evolve and
claim a place in the agentic ecosystem where it can actually thrive. The ecosystem needs
PAI's human-centric philosophy more than ever — it just needs it unbundled, opened up, and
free to travel. I'd love nothing more than to stay.
