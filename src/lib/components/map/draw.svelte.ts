/**
 * What the map draws on top of the choropleth. Read only inside the map, so it stays
 * out of the explorer, where every reader would have to learn it.
 */
class Draw {
  labels = $state(true);
  plates = $state(true);
  rail = $state(true);
  dogs = $state(true);
  shelters = $state(true);

  get flourishes() {
    return [
      {
        key: "labels" as const,
        label: "names of every neighborhood",
        on: this.labels,
      },
      { key: "plates" as const, label: "the dogs themselves", on: this.plates },
      {
        key: "rail" as const,
        label: "six railroads, dogs and all",
        on: this.rail,
      },
      { key: "dogs" as const, label: "a paw for every 75 dogs", on: this.dogs },
      {
        key: "shelters" as const,
        label: "the shelters taking dogs in",
        on: this.shelters,
      },
    ];
  }

  flip(key: "labels" | "plates" | "rail" | "dogs" | "shelters") {
    this[key] = !this[key];
  }
}

export const draw = new Draw();
