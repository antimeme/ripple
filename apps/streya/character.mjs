import Omnivore from "../ripple/omnivore.mjs";

function chooseKey(object, getWeight = (o, k) => 1) {
    const choice = Math.random();
    let result = undefined;
    let total = 0;
    let used = 0;
    Object.keys(object).forEach(key =>
        { total += getWeight(object, key); });
    Object.keys(object).forEach(key => {
         const weight = getWeight(object, key);
        if (!result && (choice * total < used + weight)) {
            result = key;
        } else used += weight;
    });
    return result;
}

function createRecruit(setting) {
    const birthplace = chooseKey(setting.places);
    const gender = chooseKey({"Male": 1, "Female": 1}, (o, k) => o[k]);
    const heritage = chooseKey(
        setting.places[birthplace].population,
        (o, k) => o[k]);

    if (heritage) {
        const namegen = Omnivore.createGrammar(
            setting.cultures[heritage].namegen);
        name = namegen.generate(((gender === "Male") ?
                                 "fname_male" : "fname_female")) + " " +
               namegen.generate("surname");
    } else name = "BLATT";

    const background = [];
    let current = chooseKey(setting.backgrounds, (o, k) =>
        o[k].recruit ? 1 : 0);
    while (current) {
        const previous = setting.backgrounds[current]?.previous;
        background.push(current);

        if (previous)
            current = chooseKey(previous);
        else current = undefined;
    }
     
    // :TODO: accumulate skills
    // :TODO: create inventory with some items

    function createItem(text) {
        const result = document.createElement("li");
        result.appendChild(document.createTextNode(text));
        return result;
    }

    const fieldset = document.createElement("fieldset");
    const contents = document.createElement("ul");
    const legend = document.createElement("legend");
    legend.appendChild(document.createTextNode(
        name ? name : "Name"));
    fieldset.appendChild(legend);
    fieldset.appendChild(contents);
    fieldset.classList.add("recruit");

    contents.appendChild(createItem("Gender: " + gender));
    contents.appendChild(createItem("Born: " + birthplace));
    contents.appendChild(createItem("Culture: " + heritage));
    contents.appendChild(document.createElement("hr"));
    background.forEach(b => { contents.appendChild(createItem(b)) });

    return fieldset;     
}

export default {
    createRecruit
};
