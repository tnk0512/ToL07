---
title: "BloomTree: Dynamic Coloring Techniques for Exploring Deep and Wide Tree Structures"
date: "June 7, 2026"
author: "Amane Tanaka, Ken Wakita"
---

# Scheduled Presentation at EuroVis 2026

- **Title**: BloomTree: Dynamic Coloring Techniques for Exploring Deep and Wide Tree Structures
- **Authors**: Amane Tanaka, Ken Wakita
- **Date**: June 8, 2026 – June 12, 2026
- **Venue**: Nottingham, UK

## Abstract
This study introduces BloomTree, an interactive Sunburst system for visualizing massive hierarchical datasets, such as the Tree of Life. Traditional static color schemes fail to maintain perceptual distinguishability when applied to millions of nodes, and managing the full tree in memory is computationally costly. BloomTree addresses these challenges through a combined strategy, centered on dynamic, view-dependent, topology-aware color allocation. This technique recomputes color assignments for the visible subtree after each navigation step. This ensures closely related regions appear with coherently related hues and adjacent sectors maintain sufficient contrast. Furthermore, to preserve the user’s mental map during navigation, zooming operations are smoothly animated by simultaneously interpolating sector geometry and color assignments. For computational scalability, BloomTree uses selective subtree streaming and metanode aggregation to handle massive data, storing the full tree on a backend server and streaming only a truncated visible region. We evaluate BloomTree at the system and user levels. System analysis shows that selective streaming and metanode aggregation significantly improve computational scalability, reducing communication volume to about 1/70 and rendering cost to about 1/2,000. A controlled user study confirms that dynamic coloring yields faster responses and higher accuracy for several perceptual and structural tasks, highlighting the effectiveness of the system for exploring multi-million-node trees.

## Demo Video
=======

A video demonstrating the navigation process from **Biota** (root) to **Homo sapiens** (leaf) is shown below.<br>

<img src="./evis_demo.gif" style="width: 150%; max-width: 1000px;">

- Clicking the 4th layer starts a four-step animation.

- We can observe that tetrapods include:
    - amphibians, birds, mammals, reptiles, and more.<br>

- Next, we click on **Mammalia** in the 3rd layer.<br>

- We can observe that mammals include:
    - rodents, even-toed ungulates, primates, carnivores, and more.<br>

- Then, we select **Primates**.

- Clicking the image, as well as using the search function, highlights the path to the selected node.<br>

- Humans, gorillas, and chimpanzees are taxonomically close relatives (^ ^)
