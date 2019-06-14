from PIL import Image, ImageDraw


def find_coords(results, name, side):
    for r in results:
        if r["name"] == name and r["side"] == side:
            return r["x"], r["y"]
    return None


def draw_annotations(image, annotations, confidence_threshold=0.7):
    im = Image.open(image)
    width, height = im.size
    draw = ImageDraw.Draw(im)

    for r in annotations:
        fill = (255, 0, 0) if r["score"] >= confidence_threshold else (128, 128, 128)
        draw.ellipse(
            [
                (r["x"] * width - 3, r["y"] * height - 3),
                (r["x"] * width + 3, r["y"] * height + 3),
            ],
            fill=fill
        )

    lines = [
        (("wrist", 0), ("elbow", 0)),
        (("wrist", 1), ("elbow", 1)),
        (("elbow", 0), ("shoulder", 0)),
        (("elbow", 1), ("shoulder", 1)),
        (("ankle", 0), ("knee", 0)),
        (("ankle", 1), ("knee", 1)),
        (("knee", 0), ("hip", 0)),
        (("knee", 1), ("hip", 1)),
        (("chin", 0), ("forehead", 0)),
        (("hip", 0), ("shoulder", 0)),
        (("hip", 1), ("shoulder", 1)),
        (("hip", 0), ("hip", 1)),
        (("shoulder", 0), ("chin", 0)),
        (("shoulder", 1), ("chin", 0)),
        (("shoulder", 0), ("shoulder", 1)),
    ]

    for start, end in lines:
        x1, y1 = find_coords(annotations, start[0], start[1])
        x2, y2 = find_coords(annotations, end[0], end[1])

        if start[1] == 1 and end[1] == 1:
            color = (255, 255, 0)  # yellow
        elif start[1] == 0 and end[1] == 0:
            color = (0, 255, 0)  # green
        else:
            color = (255, 0, 0)  # red

        draw.line(
            [(x1 * width, y1 * height), (x2 * width, y2 * height)],
            fill=color
        )

    del draw
    return im
