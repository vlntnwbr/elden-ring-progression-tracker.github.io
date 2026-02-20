const _VERSION = {
    major: 2,
    patch: 0,
    minor: 0
}

const PATTERN = new Uint8Array([176, 173, 1, 0, 1, 255, 255, 255]);
const PATTERN_FALLBACK = new Uint8Array([176, 173, 1, 0, 1]);

let COLLECTIBLES_DATA;          // Global Store for assets/data/collectibles.json
let ITEM_DATA = {};             // Global Store for assets/data/(dlc?)data.json
let SAVEFILE_CONTENT = null;    // Global Store for the binary contents of the savefile

// TODO evaluate the need for these
let slots = [];
let idList = [];
let dlcFile = false;

/*
TODO: if only one save slot is read from the file, automatically calculate progression
TODO: Add the quantities of found items to the itemCard
TODO: Fix the icon-lists for Collectibles other than Cracked Pot
*/

/*---
    HTML Templates filled by the result of savefile analysis
---*/

/** Get select option for a character slot from a savefile. */
const CharacterSelectionOption = (value, idx) => (
    value ? `<option value=${idx}>${value}</option>` : null
);

/**
 * Creates a details element with progress tracking.
 * @param {string} kind - Whether the entry is for a zone or a region. Zone details are
 *                        of class `zoneTitle` and its collapsible section is of class
 *                        `itemList`. Region details are of class `regionTitle`.
 * @param {string} name - The display name of the entry. Used in the details summary.
 *                        For the name `Collectibles` the collapsible section is of
 *                        class `itemList`.
 * @param {number} found - The number of found items. Used in the details summary.
 * @param {number} total - The total number of items. Used in the details summary.
 * @param {string} details - The HTML content to display as the collapsible details.
 * @param {string} [icons] - Optional HTML icons for Collectibles in area. Used in the
 *                           details summary.
 * @returns {string} An HTML string for a collapsible section summarizing items.
 */
const ItemSummarySection = (
    kind, name, found, total, details, icons
) => (`
    <details
      id="${name.replace(" ", "-").toLowerCase()}-${found}-${total}"
      class="${found == total ? "completed" : "in-progress"}"
    >
      <summary class="${kind}Title">
        <${kind === "zone" ? "h4" : "h3"} class="sectionHeading">
          ${name}
          ${icons ? `<span class="iconList">${icons}</span>` : ""}
          <span class="counter">${found}/${total} • ${
            total != 0 ? Math.floor((found / total) * 100) : 100
          }%
        </${kind === "zone" ? "h4" : "h3"}>
      </summary>
      <div ${kind === "zone" || name === "Collectibles" ? `class="itemList"`: ""}>
        ${details}
      </div>
    </details>
`);

/**
 * Generates a styled <article class="itemCard"> for Elden Ring items.
 * 
 * @param {string} name - Item Name. Used as the article heading. This value is exposed
 *                        via `itemCard.dataset.itemName`.
 * @param {string} type - The type of the item. A value starting with `collectible`
 *                        receives special treatment. The value is used as an additional
 *                        class. All others are wrapped in a link to the Elden Ring 
 *                        wiki. For these cards the type is used for determining the
 *                        display image if an item is not `found`. The value is exposed
 *                        via `itemCard.dataset.itemType`.
 * @param {string} id - The unique identifier for the item card element
 * @param {string} hint - For items of type `collectible` this value is displayed below
 *                        the name. For all others it is used for displaying a text when
 *                        hovering over the card of an item that was not found.
 * @param {boolean} [found=true] - If an item was not found the link wrapping the card is
 *                                 removed and the classes `disabledCard tooltip` are
 *                                 added. Defaults to true to ensure correct asset
 *                                 fetching for `collectible` cards.
 * @param {string} [url=""] - Optional URL link to the item's wiki page. Used as `href`
 *                            for the link wrapping cards of found items. Defaults to an
 *                            empty string because `collectible` cards are not linked.
 *                            If set it is exposed via `itemCard.dataset.itemWikiLink`.
 * @returns {string} An HTML string representing the item card article element
 */
const ItemCard = (name, type, id, hint, found = true, url = "") => {
    const isCollectible = (type.startsWith("collectible"));
    return (
    `<article
      class="itemCard ${
        isCollectible ? type : found ? '' : 'disabledCard tooltip'
      }"
      id="${id}"
      data-item-name="${name}"
      data-item-type="${type}"
      ${url ? `data-item-wiki-link="${url}"`: ""}
    >
      ${!isCollectible && found ? `<a target="_blank" href="${url}">` : ''}
      <img
        alt="${found ? name : type}"
        src="${Item.getImageAsset(name, type, found)}"
      />
      <h5>
        ${found ? name : Item.NOT_FOUND_NAME}
      </h5>
      ${!isCollectible && !found ? `<div class="tooltip-text">${hint}</div>` : ``}
      ${isCollectible ? `<p class="more-info">${hint}</p>` : ""}
      ${!isCollectible && found ? `</a>` : ``}
    </article>
`)};

/*---
    Helpers for sanitizing Item Data for use in HTML
---*/

function sanitizeURL(name) {
    if (name === "Gauntlets")
        return "Chain+Gauntlets";
    return name
        .replaceAll(" +1", "")
        .replaceAll(" +2", "")
        .replaceAll(" (1)", "")
        .replaceAll(" (2)", "")
        .replaceAll("[", "(")
        .replaceAll("]", ")")
        .replaceAll(" ", "+");
}

function sanitizeImgName(name) {
    if (name.includes("Bell Bearing")) {
        return "Bell Bearing";
    }
    if (name.includes("Note:")) {
        return "Note";
    }
    let newName = name.replaceAll(":", "").replaceAll("?", "");
    const index = newName.search(" \\[");
    if (index > 0) newName = newName.substring(0, index);
    return newName;
}

/*---
    Helpers for processing progression and compiling HTML description
    list entries with cards for each item.
---*/

class Item {

    // TODO add quantities
    static NOT_FOUND_NAME = "??????????";
    
    constructor(key, item) {
        this.key = key                   // value from json/data.json
        this.name = item.name;           // value from json/data.json
        this.type = item.type;           // value from json/data.json
        this.hint = item.hint;           // value from json/data.json
        this.multiple = item.multiple;   // value from json/data.json
        this.found = idList.includes(key);
        this.url = `https://eldenring.wiki.fextralife.com/${
            sanitizeURL(this.name)
        }`;
        this._image = Item.getImageAsset(this.name, this.type, this.found);
    }

    static getImageAsset(name, type, found) {return `assets/img/${ found
        ? `items/${sanitizeImgName(name)}.webp`
        : `hints/${type}.png`
    }`}

    getHTML() { return ItemCard(
        this.name, this.type, this.key, this.hint, this.found, this.url
    )}
}

class Zone {

    constructor(zoneTitle, zoneData) {
        this.counter = 0;
        this.total = 0;
        this.title = zoneTitle;
        this.itemsHTML = "";
        this.iconList = this.getIconList();
        Object.keys(zoneData).forEach(itemKey => {
            const item = new Item(itemKey, zoneData[itemKey]);
            this.total++;
            if (item.found) this.counter++;
            this.itemsHTML += item.getHTML();
        })
    }

    getIconList() {
        const icons = [];
        COLLECTIBLES_DATA.forEach((item) => {
            const n = item.places.reduce(
                (count, location) => (
                    location === this.title ? count + 1 : count
                ), 0
            );
            for (let i = 0; i < n; i++) {
                icons.push(`
                <img
                    alt="${item.name}"
                    title="${item.name}"
                    src="${Item.getImageAsset(item.name, "", true)}"
                />`);
            }
        });
        return icons;
    }

    getHTML() { return ItemSummarySection(
        "zone",
        this.title,
        this.counter,
        this.total,
        this.itemsHTML,
        this.iconList.join("")
    )}
}

class Region {

    constructor (regionTitle, regionData) {
        this.counter = 0;
        this.total = 0;
        this.title = regionTitle;
        this.regionsHTML = [];
        // this.iconList = ""
        Object.keys(regionData).forEach(zoneTitle => {
            const zone = new Zone(zoneTitle, regionData[zoneTitle]);
            this.counter += zone.counter;
            this.total += zone.total
            this.regionsHTML.push(zone.getHTML())
        });
    }

    getHTML() { return ItemSummarySection(
        "region",
        this.title,
        this.counter,
        this.total,
        `${this.regionsHTML.join("")}`
    )}
}

function getCollectibles(character) {
    const itemsQuantities = findItemQuantities(slots[character]);
    const itemsFound = itemsQuantities.reduce((prev, cur) => prev + cur, 0);
    const totalItems = COLLECTIBLES_DATA.reduce(
        (prev, cur) => prev + cur.places.length, 0
    );
    let itemsHTML = "";
    COLLECTIBLES_DATA.forEach((item, idx) => {
        const found = itemsQuantities[idx];
        const total = item.places.length
        itemsHTML += ItemCard(
            item.name,
            `collectible${found === total ? "-completed": ""}`,
            `collectible-${idx}`,
            `${found}/${total}`
        )
    })
    const entry = ItemSummarySection(
        "region", "Collectibles", itemsFound, totalItems, itemsHTML
    )
    return [itemsFound, totalItems, entry]
}

/*--
    File Reading functions
--*/

async function readJsonFiles() {
    try {
        let res = await fetch("assets/json/data.json");
        const itemsData1 = await res.json();
        let res2 = await fetch("assets/json/dlcData.json");
        const itemsData2 = await res2.json();
        ITEM_DATA = { ...itemsData1, ...itemsData2 };
        res = await fetch("assets/json/collectibles.json");
        COLLECTIBLES_DATA = await res.json();
    }
    catch (e) {
        console.error(e);
    }
}

function bufferEqual(buf1, buf2) {
    if (buf1.byteLength !== buf2.byteLength) return false;
    const dv1 = new Int8Array(buf1);
    const dv2 = new Int8Array(buf2);
    for (let i = 0; i !== buf1.byteLength; i++) {
        if (dv1[i] !== dv2[i]) return false;
    }
    return true;
}

/** Read the Elden Ring Save file uploaded by the user
 * 
 * This populates the <file_read> global variable
 * 
 * After populating the global variable it checks that value against an array
 * to validate if the savefile is valid. It resets the global variable.
 * It is awaited in the onChange handler of the file selector
*/
function readFile(savefile) {
    return new Promise((resolve, reject) => {
        const file = savefile;
        const reader = new FileReader();
        reader.onload = e => {  // executed when reader has read the file
            SAVEFILE_CONTENT = e.target.result;
            if (
                !bufferEqual(
                    SAVEFILE_CONTENT["slice"](0, 4),
                    new Int8Array([66, 78, 68, 52]))
            ) {
                e.target.result = null;
                document.getElementById("characterSelectForm").style.display = "none";
                alert("Insert a valid file");
                reject();
                return;
            }
            resolve();
        };
        reader.onerror = e => {
            console.error("Error : " + e.type);
            reject();
        };
        reader.readAsArrayBuffer(file);  // read the uploaded file.
    });
}

/** Read the character names from the slots in the savefile */
function getNames(fromSavefile) {
    const decoder = new TextDecoder("utf-8");
    const _decode = (sliceStart, sliceStop, stopOffset = 32) => decoder.decode(
        new Int8Array(Array.from(new Uint16Array(fromSavefile.slice(
            sliceStart,
            sliceStop + stopOffset
    )))));

    const slotBytes = [
        [0x1901d0e, 0x1901d0e],
        [0x1901f5a, 0x1901f5a],
        [0x19021a6, 0x19021a6],
        [0x19023f2, 0x19023f2],
        [0x190263e, 0x190263e],
        [0x190288a, 0x190288a],
        [0x1902ad6, 0x1902ad6],
        [0x1902d22, 0x1902d22],
        [0x1902f6e, 0x1902f6e],
        [0x19031ba, 0x19031ba]
    ];
    const names = [];
    slotBytes.forEach( ( slot ) => names.push(
        _decode(slot[0], slot[1]).replaceAll("\x00", "")
    ));
    return names;
}

function fetchInventory(character) {
    console.info("fetching inventory for save slot:", character);
    const saves_array = new Uint8Array(SAVEFILE_CONTENT);
    slots = get_slot_ls(saves_array);
    const inventory = Array.from(getInventory(slots[character]));
    idList = split(inventory, dlcFile ? 8 : 16);
    idList.forEach((raw_id, index) => (
        idList[index] = getIdReversed(raw_id).toUpperCase())
    );
    /*  Compare IDs found in inventory with database and log the ones not considered
        by this tool. This is useful for debugging incorrectly identified items.     */
    // const allItems = [];
    // Object.keys(ITEM_DATA).forEach(regionTitle => (
    //     Object.keys(ITEM_DATA[regionTitle]).forEach(zoneTitle =>
    //         allItems.push(...Object.keys(ITEM_DATA[regionTitle][zoneTitle]))
    //     )
    // ))
    // const uniqueItems = new Set(allItems);
    // const itemsInInventoryNotInItemsList = idList.filter(item => !uniqueItems.has(item))
    // console.debug(itemsInInventoryNotInItemsList);

}

function get_slot_ls(dat) {
    const slot1 = dat.subarray(0x00000310, 0x0028030f + 1);
    const slot2 = dat.subarray(0x00280320, 0x050031f + 1);
    const slot3 = dat.subarray(0x500330, 0x78032f + 1);
    const slot4 = dat.subarray(0x780340, 0xa0033f + 1);
    const slot5 = dat.subarray(0xa00350, 0xc8034f + 1);
    const slot6 = dat.subarray(0xc80360, 0xf0035f + 1);
    const slot7 = dat.subarray(0xf00370, 0x118036f + 1);
    const slot8 = dat.subarray(0x1180380, 0x140037f + 1);
    const slot9 = dat.subarray(0x1400390, 0x168038f + 1);
    const slot10 = dat.subarray(0x16803a0, 0x190039f + 1);
    return [slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8, slot9, slot10];
}

function getInventory(slot) {
    index = subfinder(slot, PATTERN) + PATTERN.byteLength + 8;
    if (!index) {
        index = 0;
        do {
            index += subfinder(
                slot.subarray(index), PATTERN_FALLBACK
            ) + PATTERN_FALLBACK.byteLength + 3;
        } while (slot[index - 3] != 0 && index);
        dlcFile = true;
    }
    index1 = subfinder(
        slot.subarray(index, slot.byteLength),
        new Uint8Array(50).fill(0)
    ) + index + 6;
    return slot.subarray(index, index1);
}

function subfinder(mylist, pattern) {
    for (let i = 0; i < mylist.byteLength; i++) {
        if (
            mylist[i] === pattern[0]
            && bufferEqual(
                mylist.subarray(i, i + pattern.byteLength),
                pattern
            )
        ) return i;
    }
}

function split(list_a, chunk_size) {
    const splitted = [];
    for (let i = 0; i < list_a.length; i += chunk_size) {
        let chunk = list_a.slice(i, i + chunk_size);
        splitted.push(chunk);
    }
    return splitted;
}

function getIdReversed(id) {
    let final_id = "";
    tmp = id.slice(0, 4).reverse();
    for (let i = 0; i < 4; i++) {
        final_id += decimalToHex(tmp[i], 2);
    }
    return final_id;
}

function decimalToHex(d, padding) {
    let hex = Number(d).toString(16);
    padding = (
        typeof padding === "undefined" || padding === null
        ? (padding = 2)
        : padding
    );

    while (hex.length < padding) {
        hex = "0" + hex;
    }
    return hex;
}

function findItemQuantities(slot) {
    const result = new Array(COLLECTIBLES_DATA.length).fill(0);
    for (let i = 0; i < slot.byteLength - 4; i++) {
        for (let j = 0; j < COLLECTIBLES_DATA.length; j++) {
            const item = COLLECTIBLES_DATA[j];
            if (
                slot[i] === item.id[0]
                && slot[i + 1] === item.id[1]
                && slot[i + 2] === item.id[2]
                && slot[i + 3] === 176
            ) { result[j] = slot[i + 4];}
        }
    }
    return result;
}

/*---
    Helpers for updating element visibilities based on user interaction
---*/

/**
 * Toggle display of details for items that were not found in the players inventory.
 * 
 * @param {Boolean} value Show details if `true`, otherwise hide them.
 * 
 * When details are shown the regular item name and image are displayed and the link to
 * the Elden Ring wiki  wrapping the card is restored. The tooltip gets an additional
 * hint that clicking the card will open the wiki.
 */
function toggleNotFoundItems(value) {
    const disabledCardList = document.getElementsByClassName("disabledCard");
    Array.from(disabledCardList).forEach((card) => {
        let itemName = card.dataset.itemName;
        const clickHint = "Click to open the wiki page.";
        const tooltip = () => card.getElementsByTagName("div")[0];
        if (value) {
            card.innerHTML = `
                <a target="_blank" href="${card.dataset.itemWikiLink}">
                    ${card.innerHTML}
                </a>
            `;
            tooltip().innerHTML = `${clickHint}${tooltip().innerHTML}`;
        } else {
            tooltip().innerHTML = tooltip().innerHTML.replace(clickHint, "");
            card.innerHTML = card.getElementsByTagName("a")[0].innerHTML;
            itemName = Item.NOT_FOUND_NAME;
        }
        const image = Item.getImageAsset(itemName, card.dataset.itemType, value);
        card.getElementsByTagName("img")[0].src = image;
        card.getElementsByTagName("h5")[0].innerText = itemName;
    });
}

/**
 * Toggle visibility of all elements that only relate to found items.
 * - itemCards that represent items found in the players inventory
 * - itemCards for collectibles that are at the total available amount
 * - Zone sections that are marked as completed
 * - Region sections are marked as completed
 * 
 * @param {Boolean} value hide elements if `true`, otherwise unhide them
 * 
 * Relevant cards are identified by their class names, relevant sections are
 * identified by the class of the details section.
*/
function toggleShowOnlyNotFoundItems(value) {
    const foundItemCards = document.querySelectorAll(
        ".itemCard:not(.disabledCard):not(.collectible)"
    );
    Array.from(foundItemCards).forEach((card) => {
        card.style.display = value ? "none" : ""
    });
    const foundCompletedCards = document.querySelectorAll("details.completed");
    Array.from(foundCompletedCards).forEach(card => 
        card.style.display = value ? "none" : ""
    )
}

function toggleDetailsOpen(value) {
    document.querySelectorAll("details").forEach(section => section.open = value);
}

/*---
    Main Methods for setting up the webpage and updating the view
    based on the stage of progression evaluation.
---*/

/** Create the character selection options from savefile contents.
 * 
 *  Is executed in the savefile change handler after the uploaded file was read.
 * 
 * @param {URLSearchParams} params look for the "character" parameter, if present set
 *                                 its value as the selected option and trigger a change
*/
function makeSlotSelectForm(params) {
    // Setup select form
    const selectInput = (suffix = "") => (
        document.getElementById(`characterSelectInput`)
    );
    const characterHeading = document.getElementById("characterName");
    selectInput().onchange = e => {
        document.getElementById("formSection").style.display = "none";
        const selectedCharacter = selectInput().value;
        const characterName = selectInput().options[
            Number(selectedCharacter) + 1
        ].innerText;
        console.info("SlotSelectForm: selected character:", characterName);
        characterHeading.dataset.character = characterName;
        characterHeading.innerText = characterName;
        fetchInventory(selectedCharacter);
        calculate(selectedCharacter);
        
    };
    // Populate options with character names
    getNames(SAVEFILE_CONTENT).forEach((slot, idx) => (
        selectInput().innerHTML += CharacterSelectionOption(slot, idx)
    ));
    // pre-select a save slot from query parameter if available
    const character = params.get("character");
    if (character) {
        const match = Array.from(selectInput().options).find(
            opt => opt.text.trim() === character
        );
        if (match) {
            selectInput().value = match.value;
            selectInput().dispatchEvent(new Event("change"));
        } else {
            console.warn(`No slot '${character}' in savefile;`);
        }
    }
    // Show the select form
    document.getElementById("characterSelectForm").style.display = "block";
}

/** Evaluate character inventory and populate the `completionProgress` HTML section
 * 
 * It is filled with collapsible sections representing regions in the
 * game. Each region is divided further into zones that are filled with
 * a grid of cards for all items available in a region. By default, the
 * names and icons for missing items are obscured and a hint how to find
 * them is displayed on hover.
*/
async function calculate(character) {
    let globalCounter = 0;
    let globalTotal = 0;
    // Start with Collectible Progression
    let collectibleProgress = getCollectibles(character);
    globalCounter += collectibleProgress[0];
    globalTotal += collectibleProgress[1];
    let completionProgressHTML = collectibleProgress[2];
    // Add Region Progression
    Object.keys(ITEM_DATA).forEach(regionTitle => {
        const region = new Region(regionTitle, ITEM_DATA[regionTitle]);
        globalCounter += region.counter;
        globalTotal += region.total;
        completionProgressHTML += region.getHTML();
    });
    // Add global completion summary
    document.getElementById("globalCompletion").innerText = `
        Completion: ${Math.floor(globalCounter / globalTotal * 100)}%
    `;
    // Set content of progress section and show completion results
    document.getElementById("completionProgress").innerHTML = completionProgressHTML;
    document.getElementById("resultSection").style.display = "";
    document.getElementById("viewModifiers").style.display = "flex";
}

window.onload = async () => {
    console.info(`Running Elden Ring Progression Tracker v${
        Object.values(_VERSION).join(".")}`
    );
    readJsonFiles();
    const params = new URLSearchParams(window.location.search);
    const fileSelector = () => document.getElementById("savefile");
    fileSelector().addEventListener("change", async (event) => {
        let selector = fileSelector();
        if (selector.value === null) {
            alert("No file selected");
            return;
        }
        document.getElementById("hint-for-savefile").style.display = "none";
        await readFile(selector.files[0]);
        makeSlotSelectForm(params);
    });
}