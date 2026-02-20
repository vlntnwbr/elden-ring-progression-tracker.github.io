const VERSION = { major: 2, minor: 0, patch: 0 };

let COLLECTIBLES_DATA;          // Global Store for assets/data/collectibles.json
let ITEM_DATA = {};             // Global Store for assets/data/(dlc?)data.json

/*
TODO: if only one save slot is read from the file, automatically calculate progression
TODO: Add the quantities of found items to the itemCard
*/

/*---
    HTML Templates filled by the result of savefile analysis
---*/

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
    
    constructor(key, item, inventory) {
        this.key = key                   // key from json/data.json
        this.name = item.name;           // value from json/data.json
        this.type = item.type;           // value from json/data.json
        this.hint = item.hint;           // value from json/data.json
        this.multiple = item.multiple;   // value from json/data.json
        this.found = inventory.includes(key);
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

    constructor(zoneTitle, zoneData, inventory) {
        this.counter = 0;
        this.total = 0;
        this.title = zoneTitle;
        this.itemsHTML = "";
        this.iconList = this.getIconList();
        Object.keys(zoneData).forEach(itemKey => {
            const item = new Item(itemKey, zoneData[itemKey], inventory);
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

    constructor (regionTitle, regionData, inventory) {
        this.counter = 0;
        this.total = 0;
        this.title = regionTitle;
        this.regionsHTML = [];
        // this.iconList = ""
        Object.keys(regionData).forEach(zoneTitle => {
            const zone = new Zone(zoneTitle, regionData[zoneTitle], inventory);
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

function getCollectibles(slot) {
    const itemsQuantities = findItemQuantities(slot);
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

class SaveFileReader {

    #PATTERN_BASE = new Uint8Array([176, 173, 1, 0, 1, 255, 255, 255]);
    #PATTERN_SOTE = new Uint8Array([176, 173, 1, 0, 1]);

    constructor() {
        this.rawContent = null;
        this.slots = {};
        this.dlcFile = false;
    }

    async setContent(file) { return new Promise((resolve, reject) => {
        
        console.debug("SaveFileReader: reading file contents")
        const reject_promise = (message, error="") => {
            console.error(
                `Error: SaveFileReader: ${message.lower()}${error ? `: ${e.type}` : ""}`
            );
            alert(message);
            reject();
        }
        const reader = new FileReader();
        // Set the handler for successfully reading file contents
        reader.onload = e => {
            if (this.#validateSavefile(e.target.result)) {
                this.rawContent = e.target.result;
                resolve();
            } else {
                e.target.result = null;
                // let's see if we need this, we should probably do a try catch
                document.getElementById("characterSelectForm").style.display = "none";
                reject_promise("Uploaded file is invalid.");
            }
        };
        // Set the error handler to execute when file cannot be read.
        reader.onerror = error => reject_promise("Cannot read file contents", error);
        // Read the uploaded file contents and trigger handlers
        reader.readAsArrayBuffer(file);
    });
        
    }

    /**
     * Validate if the content is an Elden Ring savefile by checking its magic number.
     * @private
     * @param {Buffer|Uint8Array|Int8Array} content - The file content to validate
     * @returns {boolean} True if content starts with magic number `BND4`.
     */
    #validateSavefile(content) { return this.#bufferEqual(
        content["slice"](0, 4),
        new Int8Array([66, 78, 68, 52])
    );}

    /**
     * Compares two ArrayBuffer objects for equality.
     * @private
     * @param {ArrayBuffer} buffer - The first buffer to compare.
     * @param {ArrayBuffer} expectedBuffer - The second buffer to compare.
     * @returns {boolean} True if both buffers have identical byte length and values.
     */
    #bufferEqual(buffer, expectedBuffer) {
        if (buffer.byteLength !== expectedBuffer.byteLength) return false;
        const dv1 = new Int8Array(buffer);
        const dv2 = new Int8Array(expectedBuffer);
        for (let i = 0; i !== buffer.byteLength; i++) {
            if (dv1[i] !== dv2[i]) return false;
        }
        return true;
    }

    setSaveSlots() {
        if (!this.rawContent) throw new Error(
            "SaveFileReader: Error: cannot read save slots without savefile content"
        );
        console.debug("SaveFileReader: extracting character slots from savefile");
        // Boundaries of where the encoded character name of all 10 save slots and
        // their respective inventories are located in the savefile contents.
        let saveSlotLocations = [
            {
                "name": [0x1901d0e, 0x1901d0e],
                "inventory": [0x00000310, 0x0028030f]
            },
            {
                "name": [0x1901f5a, 0x1901f5a],
                "inventory": [0x00280320, 0x050031f]
            },
            {
                "name": [0x19021a6, 0x19021a6],
                "inventory": [0x500330, 0x78032f]
            },
            {
                "name": [0x19023f2, 0x19023f2],
                "inventory": [0x780340, 0xa0033f]
            },
            {
                "name": [0x190263e, 0x190263e],
                "inventory": [0xa00350, 0xc8034f]
            },
            {
                "name": [0x190288a, 0x190288a],
                "inventory": [0xc80360, 0xf0035f]
            },
            {
                "name": [0x1902ad6, 0x1902ad6],
                "inventory": [0xf00370, 0x118036f]
            },
            {
                "name": [0x1902d22, 0x1902d22],
                "inventory": [0x1180380, 0x140037f]
            },
            {
                "name": [0x1902f6e, 0x1902f6e],
                "inventory": [0x1400390, 0x168038f]
            },
            {
                "name": [0x19031ba, 0x19031ba],
                "inventory": [0x16803a0, 0x190039f]
            }
        ];
        // Helpers for decoding the slot name
        const _nameDecoder = new TextDecoder("utf-8");
        const getName = (slot) => _nameDecoder.decode(
            new Int8Array(Array.from(new Uint16Array(this.rawContent.slice(
                slot.name[0], slot.name[1] + 32
            ))))
        ).replace(/\u0000+$/, "").trim();
        // Helpers for slicing the savefile into inventory arrays
        const slotsArray = new Uint8Array(this.rawContent);
        const getInventory = (slot) => slotsArray.subarray(
            slot.inventory[0], slot.inventory[1] + 1
        )
        // Populate save slots array
        saveSlotLocations.forEach(slot =>
            this.slots[getName(slot)] = getInventory(slot)
        );
    }

    fetchInventory(character) {
        const error = (message) => new Error(
            `SaveFileReader: Error: cannot fetch inventory for ${character}: ${message}`
        )
        if (Object.keys(this.slots).length === 0) throw error(
            "save slots not available"
        );
        console.debug(`SaveFileReader: fetching inventory for '${character}'`);
        const inventorySlot = this.slots[character];
        if (!inventorySlot) throw error("slot was not found in savefile content");
        const inventoryArray = this.#getInventoryArray(inventorySlot);
        return this.#getItemsFromInventory(inventoryArray);
    }

    #getInventoryArray(slot) {
        // Determine the start boundary of the inventory subarray
        console.debug("SaveFileReader: processing inventory slot");
        let startIndex = this.#getBoundary(
            slot, this.#PATTERN_BASE
        ) + this.#PATTERN_BASE.byteLength + 8 || 0;
        // No index found, this means the uploaded savefile includes the DLC contents
        if (!startIndex) {
            this.dlcFile = true;
            do { startIndex += this.#getBoundary(
                slot.subarray(startIndex),
                this.#PATTERN_SOTE,
            ) + this.#PATTERN_SOTE.byteLength + 3;
        } while (startIndex && slot[startIndex -3] != 0);}
        // Determine the stop boundary of the inventory subarray
        let stopIndex = this.#getBoundary(
            slot.subarray(startIndex, slot.byteLength),
            new Uint8Array(50).fill(0)
        ) + startIndex + 6
        console.debug(
            `SaveFileReader: determined boundaries of ${
                this.dlcFile ? "'SOTE'" : "'BASE'"
            } savefile: start@${startIndex}; stop@${stopIndex}`
        )
        return slot.subarray(startIndex, stopIndex);
    }

    #getBoundary (slot, pattern) {
        for (let i = 0; i < slot.length; i++) if (
            slot[i] === pattern[0] &&
            this.#bufferEqual(slot.subarray(i, i + pattern.byteLength), pattern)
        ) return i;
    }

    #getItemsFromInventory(inventoryArray) {
        console.debug("SaveFileReader: decoding item IDs in inventory")
        const itemList = [];
        const chunkSize = this.dlcFile ? 8 : 16;  // space taken up by a single item id
        for (let i = 0; i < inventoryArray.length; i += chunkSize) {
            let rawId = inventoryArray.slice(i, i + chunkSize);
            itemList.push(this.#getHexID(rawId));
        }
        return itemList;
    }

    #getHexID(id) {
        let decodedId = "";
        id.slice(0, 4).reverse().forEach( idPart => {
            let decodedChar = Number(idPart).toString(16);
            while (decodedChar.length < 2) decodedChar = "0" + decodedChar;
            decodedId += decodedChar;
        })
        return decodedId.toUpperCase();
    }
}

class FileUploadForm {
    constructor(queryParameters) {
        this.params = queryParameters;
        this.#getInputElement().addEventListener("change", e => this.#onChange())
    }

    show() { this.#setVisibility(""); }

    hide() { this.#setVisibility("none"); }
    
    #setVisibility(display) {
        document.getElementById("saveFileUploadForm").style.display = display;
    }
    
    #getInputElement() { return document.getElementById("saveFileInput"); }

    async #onChange() {
        if (this.#getInputElement.value === null) {
            alert("No file selected");
            return;
        }
        const saveFile = new SaveFileReader();
        await saveFile.setContent(this.#getInputElement().files[0]);
        const select = new CharacterSelectForm(saveFile, this.params.get("character"));
        select.show();  // see CharacterSelectForm.#onChange
    }
}

class CharacterSelectForm {

    constructor(savefile, queryInput) {
        savefile.setSaveSlots();
        this.savefile = savefile;
        this.queryInput = queryInput;
        console.debug("CharacterSelectForm: populating character options");
        Object.keys(this.savefile.slots).forEach( name => this.#addOption(name) );
        this.#getInputElement().addEventListener("change", e => this.#onChange());
        this.#selectFromQuery();
    }

    show() { this.#setVisibility("block"); }

    hide() { this.#setVisibility("none"); }

    #setVisibility(display) {
        document.getElementById("characterSelectForm").style.display = display;
    }
    
    #getInputElement() { return document.getElementById("characterSelectInput"); }
    
    #addOption(character) {
        if (!character) return;
        const option = document.createElement("option");
        option.text = character;
        this.#getInputElement().appendChild(option);
    }

    #getOptions() { return Array.from(this.#getInputElement().options); }

    #selectFromQuery() {
        if (!this.queryInput) return;
        const characterOption = this.#getOptions().find( option =>
            option.text.trim() === this.queryInput.trim()
        );
        if (!characterOption) {
            console.warn("CharacterSelectForm: cannot find slot for", this.queryInput);
            return;
        };
        this.#getInputElement().value = characterOption.value;
        this.#getInputElement().dispatchEvent(new Event("change"));
    }

    #onChange() {
        const selectedCharacter = this.#getInputElement().value;
        console.debug(`CharacterSelectForm: selected '${selectedCharacter}'`);
        document.getElementById("characterName").innerText = selectedCharacter;
        this.hide();
        calculate(selectedCharacter, this.savefile);
    }
}

async function calculate(character, savefile) {
    
    const inventory = savefile.fetchInventory(character);
    let globalCounter = 0;
    let globalTotal = 0;
    // Start with Collectible Progression
    let collectibleProgress = getCollectibles(savefile.slots[character]);
    globalCounter += collectibleProgress[0];
    globalTotal += collectibleProgress[1];
    let completionProgressHTML = collectibleProgress[2];
    // Add Region Progression
    Object.keys(ITEM_DATA).forEach(regionTitle => {
        const region = new Region(regionTitle, ITEM_DATA[regionTitle], inventory);
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
    document.getElementById("formSection").style.display = "none";
    document.getElementById("resultSection").style.display = "block";
    document.getElementById("viewModifiers").style.display = "flex";
}

/*--- Helpers for updating element visibility based on user interaction ---*/

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

/* --- Main Entry Point ---*/
window.onload = async () => {
    console.info(`Running Elden Ring Progression Tracker v${
        Object.values(VERSION).join(".")}`
    );
    readJsonFiles();
    const params = new URLSearchParams(window.location.search);
    new FileUploadForm(params);  // see FileUploadForm.#onChange
}