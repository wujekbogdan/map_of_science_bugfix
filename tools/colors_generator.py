#!/usr/bin/env python3
"""
colors_generator.py

Generates colors evenly distributed in the HSL color space.
Can be used to color plots or other visualizations.
"""
import argparse
import colorsys
import numpy as np
import matplotlib.pyplot as plt


def plot_colors_circle(colors):
    """
    Plot a list of colors in a circle.

    Parameters:
        colors (list of list of floats): List of colors, each color is in
            the format [R, G, B] where R, G, B are floats between 0.0 and 1.0.
    """
    # Number of colors
    n = len(colors)

    # Angle for each color in the circle
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()

    # Create figure and axis
    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))

    # Add each color as a patch in the circle
    for angle, color in zip(angles, colors):
        ax.bar(angle, 1, width=2*np.pi/n, color=color)

    # Remove the frame
    ax.set_frame_on(False)
    ax.set_yticklabels([])
    ax.set_xticklabels([])
    ax.set_xticks([])
    ax.set_yticks([])

    # Show the plot
    plt.show()


def generate_colors(N, S=0.75, L=0.5):
    """
    Generate N colors using the HSL color space.

    Parameters:
        N (int): Number of colors to generate.
        S (float): Saturation of the colors, between 0.0 and 1.0.
        L (float): Lightness of the colors, between 0.0 and 1.0.

    Returns:
        list of list of floats: List of colors, each color is in the format
        [R, G, B] where R, G, B are floats between 0.0 and 1.0.
    """
    colors = []
    for i in range(N):
        H = (i / N) * 360

        # HSL (H/360, S, L) -> RGB
        rgb = colorsys.hls_to_rgb(H / 360, L, S)

        # Round the RGB values
        rgb = tuple(round(x, 4) for x in rgb)
        colors.append(rgb)
    return colors


def main():
    # Parse arguments
    parser = argparse.ArgumentParser(
        description="Generate colors using the HSL color space.")
    parser.add_argument("N", type=int, help="Number of colors to generate.")
    parser.add_argument("S", type=float, default=0.5,
                        help="Saturation of the colors.")
    parser.add_argument("L", type=float, default=0.5,
                        help="Lightness of the colors.")
    args = parser.parse_args()

    # Generate colors
    colors = generate_colors(args.N, args.S, args.L)

    # Print the colors
    for idx, color in enumerate(colors):
        print(f"{color[0]}, {color[1]}, {color[2]}")

    # Plot the colors in a circle
    plot_colors_circle(colors)


if __name__ == "__main__":
    main()
