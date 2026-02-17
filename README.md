# Elden Ring Progression Tracker v2

Check your Elden Ring progression through the equipment and unique items found during the game.

This tool analyzes an uploaded Elden Ring savefile and checks which of the items available in the
game are found in the selected characters inventory. The results are summarized by regions who are
subdivided into their respective zone. For example, the region Limgrave has sub-entries for its
zones (e.g. Church of Elleh, Stormhill, etc.). The tool takes into account the following item types:
- Weapons
- Armor (chest/head/arms/legs)
- Talismans (except "Sacrificial Twig")
- Sorceries
- Incantations
- Spirit Ashes
- Ashes of War (except those which are given through a weapon)
- Unique Tools

Quest and Boss Remembrance rewards are listed in separate categories.

The tool also counts all non-respawning collectibles in a special summary section. These are:
- Memory Stone
- Talisman Pouch
- Cracked Pot
- Ritual Pot
- Perfume Bottles

A completion percentage is calculated for each zone, region and the entirety of the game.

> !WARNING
>
> I know the following items cannot be identified even if they are present in the inventory.
>
> - Beast Champion Armor
> - Errant Sorcerer Robe
> - War Surgeon Gown
>
> The tool also does not differentiate between unaltered and altered pieces of Armor, even if they
> have to be obtained individually and cannot be altered using tailoring.

## Missing Items
By default, items that are missing from the character's inventory have their name and image hidden.
When hovering over the missing item card a message stating how the item can be obtained is shown.
The image used for the card represents how the item can be obtained. It can be of these categories:
- Boss
- Foe
- NPC Invader
- Chest
- Merchant
- Quest
- Teardrop Scarab

There are two checkboxes available that determine which items are shown and how they are styled.
1. Show Missing Item Details
    - Checking this shows the regular names and icons for missing items and provides a link to the
      [Elden Ring Wiki] that is opened when clicking the card.
2. Show Only Missing Items
    - Checking this hides all found items as well as all completed zones and regions
  
## Special Thanks

- [Zidodelakarai] Author of the original tool from whom I forked this repository
- [Uinelj] Contributor to the original tool at the time of forking
- [BenoutAnastay] Contributor to the original tool at the time of forking
- [CyberGiant7] Author of [Elden Ring Automatic Checklist] who built the savefile reading functions
- Contributors of the [Master Spreadsheet] for figuring out the item IDs
- Reddit User [Erigondo] for providing all the [items pictures]
- All Contributors to the [Elden Ring Wiki]

###

[Zidodelakarai]: https://github.com/Zidodelakarai
[Uinelj]: https://github.com/Uinelj
[BenoutAnastay]: https://github.com/BenoitAnastay
[CyberGiant7]: https://github.com/CyberGiant7
[Elden Ring Automatic Checklist]: https://github.com/CyberGiant7/Elden-Ring-Automatic-Checklist
[Master Spreadsheet]: https://docs.google.com/spreadsheets/d/1c7rIV3bBKDxP9ngixgigd7ZmczH3DYhDmMt8HY4ijV0/edit#gid=242218508
[Erigondo]: https://www.reddit.com/user/Erigondo/
[items pictures]: https://www.reddit.com/r/fromsoftware/comments/tqoav1/all_game_item_images_sfx_spell_textures_elden_ring/
[Elden Ring Wiki]: https://eldenring.wiki.fextralife.com/Elden+Ring+Wiki